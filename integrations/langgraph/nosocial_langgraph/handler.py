"""
NoSocial callback handler for LangGraph/LangChain.

Usage:
    from nosocial_langgraph import NoSocialCallbackHandler

    handler = NoSocialCallbackHandler(oracle_url="https://api.nosocial.me")
    result = graph.invoke(input, config={"callbacks": [handler]})
"""

import logging
import time
import uuid
from typing import Any, Optional, Sequence

import requests
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.documents import Document

from nosocial_langgraph.identity import AgentIdentity
from nosocial_langgraph.mapping import (
    map_chain_end,
    map_chain_error,
    map_retriever_end,
    map_tool_end,
)

logger = logging.getLogger("nosocial")


class NoSocialCallbackHandler(BaseCallbackHandler):
    """Reports LangGraph/LangChain events as NoSocial interaction reports.

    The graph itself is the reporter. Each node/tool is a subject.
    Only reports on node-level completions (where parent_run_id is set)
    to avoid double-counting top-level graph runs.
    """

    def __init__(
        self,
        oracle_url: str = "https://api.nosocial.me",
        keys_dir: str = ".nosocial/keys",
        graph_name: str = "default-graph",
        auto_register: bool = True,
    ):
        super().__init__()
        self.oracle_url = oracle_url.rstrip("/")
        self.keys_dir = keys_dir
        self.graph_name = graph_name
        self.auto_register = auto_register
        self._identities: dict[str, AgentIdentity] = {}
        self._registered: set[str] = set()
        self._graph_identity = self._get_or_create_identity(f"graph:{graph_name}")

    def _get_or_create_identity(self, name: str) -> AgentIdentity:
        if name not in self._identities:
            self._identities[name] = AgentIdentity.load_or_create(name, self.keys_dir)
        return self._identities[name]

    def _ensure_registered(self, identity: AgentIdentity, name: str) -> bool:
        if identity.did in self._registered:
            return True
        if not self.auto_register:
            return False

        try:
            resp = requests.post(
                f"{self.oracle_url}/v1/agents/challenge",
                json={"publicKey": identity.public_key_str},
                timeout=10,
            )
            if resp.status_code == 409:
                # Check if this is genuinely "already registered" vs another 409 error
                error_msg = ""
                try:
                    error_msg = (resp.json().get("error", "") or "").lower()
                except ValueError:
                    pass
                if "already registered" in error_msg or "already exists" in error_msg:
                    self._registered.add(identity.did)
                    return True
                logger.warning(f"Oracle 409 during challenge for '{name}': {error_msg}")
                return False
            resp.raise_for_status()
            challenge_data = resp.json()

            signature = identity.sign({"challenge": challenge_data["challenge"]})
            resp = requests.post(
                f"{self.oracle_url}/v1/agents/register",
                json={
                    "challengeId": challenge_data["challengeId"],
                    "signature": signature,
                    "publicKey": identity.public_key_str,
                    "name": name,
                },
                timeout=10,
            )
            if resp.status_code == 409:
                self._registered.add(identity.did)
                return True
            resp.raise_for_status()
            self._registered.add(identity.did)
            logger.info(f"Registered agent '{name}' as {identity.did}")
            return True

        except Exception as e:
            logger.warning(f"Failed to register '{name}' with oracle: {e}")
            return False

    def _submit_report(
        self,
        reporter: AgentIdentity,
        subject: AgentIdentity,
        domain: str,
        score: float,
        context: Optional[dict] = None,
    ) -> bool:
        report = {
            "id": str(uuid.uuid4()),
            "reporter": reporter.did,
            "subject": subject.did,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "domain": domain,
            "score": max(-1.0, min(1.0, score)),
        }
        if context:
            report["context"] = context

        signature = reporter.sign(report)
        report["signature"] = signature

        try:
            resp = requests.post(
                f"{self.oracle_url}/v1/reports",
                json=report,
                timeout=10,
            )
            if resp.status_code == 201:
                logger.debug(
                    f"Reported: {reporter.did[:20]}... → {subject.did[:20]}... "
                    f"domain={domain} score={score}"
                )
                return True
            else:
                logger.warning(f"Oracle rejected report: {resp.json()}")
                return False
        except Exception as e:
            logger.warning(f"Failed to submit report: {e}")
            return False

    def _report_event(
        self,
        node_name: str,
        domain: str,
        score: float,
        context: dict,
        parent_run_id: Optional[uuid.UUID] = None,
    ) -> None:
        """Submit a report for a node-level event. Skips top-level graph runs."""
        if parent_run_id is None:
            return

        subject_name = f"{self.graph_name}:{node_name}"
        subject = self._get_or_create_identity(subject_name)

        if not self._ensure_registered(self._graph_identity, f"graph:{self.graph_name}"):
            return
        if not self._ensure_registered(subject, subject_name):
            return

        self._submit_report(
            reporter=self._graph_identity,
            subject=subject,
            domain=domain,
            score=score,
            context=context,
        )

    # --- LangChain callback methods ---
    # TODO: Consider an AsyncNoSocialCallbackHandler using httpx for
    # async LangGraph graphs. Sync callbacks are acceptable for now since
    # LangChain v0.3+ backgrounds callbacks by default.

    def on_chain_end(
        self,
        outputs: dict[str, Any],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        node_name = kwargs.get("name", "unknown-node")
        domain, score, context = map_chain_end(outputs)
        self._report_event(node_name, domain, score, context, parent_run_id)

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        node_name = kwargs.get("name", "unknown-node")
        domain, score, context = map_chain_error(error)
        self._report_event(node_name, domain, score, context, parent_run_id)

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        tool_name = kwargs.get("name", "unknown-tool")
        domain, score, context = map_tool_end(str(output))
        self._report_event(tool_name, domain, score, context, parent_run_id)

    def on_retriever_end(
        self,
        documents: Optional[Sequence[Document]],
        *,
        run_id: uuid.UUID,
        parent_run_id: Optional[uuid.UUID] = None,
        **kwargs: Any,
    ) -> None:
        retriever_name = kwargs.get("name", "unknown-retriever")
        domain, score, context = map_retriever_end(list(documents or []))
        self._report_event(retriever_name, domain, score, context, parent_run_id)
