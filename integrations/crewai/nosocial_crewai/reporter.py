"""
NoSocial reporter for CrewAI — auto-reports agent interactions to the oracle.

Usage:
    from nosocial_crewai import NoSocialReporter

    reporter = NoSocialReporter(oracle_url="https://api.nosocial.me")
    crew = Crew(
        agents=[...],
        tasks=[...],
        task_callback=reporter.task_callback,
    )
"""

import hashlib
import logging
import time
import uuid
from typing import Optional

import requests

from nosocial_crewai.identity import AgentIdentity

logger = logging.getLogger("nosocial")


class NoSocialReporter:
    """Reports CrewAI task completions as NoSocial interaction reports."""

    def __init__(
        self,
        oracle_url: str = "https://api.nosocial.me",
        keys_dir: str = ".nosocial/keys",
        crew_name: str = "default-crew",
        auto_register: bool = True,
    ):
        self.oracle_url = oracle_url.rstrip("/")
        self.keys_dir = keys_dir
        self.crew_name = crew_name
        self.auto_register = auto_register
        self._identities: dict[str, AgentIdentity] = {}
        self._registered: set[str] = set()
        # The crew itself gets an identity — it's the "reporter" in most cases
        self._crew_identity = self._get_or_create_identity(f"crew:{crew_name}")

    def _get_or_create_identity(self, name: str) -> AgentIdentity:
        """Get or create a persistent identity for a named agent."""
        if name not in self._identities:
            self._identities[name] = AgentIdentity.load_or_create(
                name, self.keys_dir
            )
        return self._identities[name]

    def _ensure_registered(self, identity: AgentIdentity, name: str) -> bool:
        """Register an agent with the oracle if not already registered."""
        if identity.did in self._registered:
            return True
        if not self.auto_register:
            return False

        try:
            # Step 1: Request challenge
            resp = requests.post(
                f"{self.oracle_url}/v1/agents/challenge",
                json={"publicKey": identity.public_key_str},
                timeout=10,
            )
            if resp.status_code == 409:
                # Already registered
                self._registered.add(identity.did)
                return True
            resp.raise_for_status()
            challenge_data = resp.json()

            # Step 2: Sign challenge and register
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
        """Submit an interaction report to the oracle."""
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

    def task_callback(self, output) -> None:
        """
        CrewAI task_callback — register on a Crew to auto-report.

        Maps task completion to a NoSocial interaction report:
        - Reporter: the crew identity (the orchestrator observing the work)
        - Subject: the agent that executed the task
        - Domain: task_completion
        - Score: 1.0 for successful completion (output exists), -0.5 for empty
        - Context: task description, agent role, output length
        """
        agent_role = self._extract_agent_name(output)
        if not agent_role:
            return

        # Namespace agent identity by crew to avoid collisions
        # (e.g., "my-crew:researcher" vs "your-crew:researcher")
        agent_name = f"{self.crew_name}:{agent_role}"
        subject = self._get_or_create_identity(agent_name)

        # Ensure both parties are registered
        if not self._ensure_registered(self._crew_identity, f"crew:{self.crew_name}"):
            return
        if not self._ensure_registered(subject, agent_name):
            return

        # Determine score from output quality signals
        raw_output = getattr(output, "raw", "") or ""
        has_output = len(raw_output.strip()) > 0
        score = 0.8 if has_output else -0.5

        context = {
            "taskType": "crewai-task",
            "skillId": self._extract_task_id(output),
            "outputAccepted": has_output,
        }

        # Report task_completion
        self._submit_report(
            reporter=self._crew_identity,
            subject=subject,
            domain="task_completion",
            score=score,
            context=context,
        )

        # If the output is substantial, also report on reliability
        if has_output:
            self._submit_report(
                reporter=self._crew_identity,
                subject=subject,
                domain="reliability",
                score=0.8,
                context=context,
            )

    def _extract_agent_name(self, output) -> Optional[str]:
        """Extract agent name from TaskOutput, handling different CrewAI versions."""
        # TaskOutput.agent is typically the agent's role string
        agent = getattr(output, "agent", None)
        if agent is None:
            return None
        # In some versions agent is a string (role), in others it's an Agent object
        if isinstance(agent, str):
            return agent
        return getattr(agent, "role", None) or getattr(agent, "name", None)

    def _extract_task_id(self, output) -> str:
        """Extract a stable task identifier from TaskOutput via content hash."""
        desc = getattr(output, "description", "") or ""
        if not desc:
            return "unknown-task"
        return hashlib.sha256(desc.encode()).hexdigest()[:12]
