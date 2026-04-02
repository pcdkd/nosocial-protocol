"""Tests for NoSocial LangGraph callback handler."""

import tempfile
import uuid

import responses

from nosocial_langgraph.handler import NoSocialCallbackHandler


ORACLE_URL = "http://test-oracle:3000"


def _mock_oracle(oracle_url: str = ORACLE_URL):
    """Set up mock oracle endpoints."""
    responses.post(
        f"{oracle_url}/v1/agents/challenge",
        json={
            "challengeId": "test-challenge-id",
            "challenge": "test-challenge-string",
            "did": "did:nosocial:abc",
            "expiresAt": "2099-01-01T00:00:00Z",
        },
        status=201,
    )
    responses.post(
        f"{oracle_url}/v1/agents/register",
        json={"did": "did:nosocial:abc", "name": "test"},
        status=201,
    )
    responses.post(
        f"{oracle_url}/v1/reports",
        json={"accepted": True},
        status=201,
    )


class TestHandlerInit:
    def test_creates_graph_identity(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                keys_dir=tmpdir,
                auto_register=False,
            )
            assert handler._graph_identity.did.startswith("did:nosocial:")

    def test_graph_identity_persists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            h1 = NoSocialCallbackHandler(keys_dir=tmpdir, graph_name="test", auto_register=False)
            h2 = NoSocialCallbackHandler(keys_dir=tmpdir, graph_name="test", auto_register=False)
            assert h1._graph_identity.did == h2._graph_identity.did


class TestOnChainEnd:
    @responses.activate
    def test_reports_on_node_completion(self):
        _mock_oracle()
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                oracle_url=ORACLE_URL,
                keys_dir=tmpdir,
                graph_name="test-graph",
            )
            handler.on_chain_end(
                outputs={"result": "done"},
                run_id=uuid.uuid4(),
                parent_run_id=uuid.uuid4(),
                name="my-node",
            )

            report_calls = [c for c in responses.calls if "/v1/reports" in c.request.url]
            assert len(report_calls) == 1

    def test_skips_top_level_graph_run(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                keys_dir=tmpdir,
                auto_register=False,
            )
            # parent_run_id=None means this is the top-level graph run
            handler.on_chain_end(
                outputs={"result": "done"},
                run_id=uuid.uuid4(),
                parent_run_id=None,
                name="graph",
            )
            # No exception, no report submitted


class TestOnChainError:
    @responses.activate
    def test_reports_negative_reliability(self):
        _mock_oracle()
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                oracle_url=ORACLE_URL,
                keys_dir=tmpdir,
            )
            handler.on_chain_error(
                error=ValueError("something broke"),
                run_id=uuid.uuid4(),
                parent_run_id=uuid.uuid4(),
                name="failing-node",
            )

            report_calls = [c for c in responses.calls if "/v1/reports" in c.request.url]
            assert len(report_calls) == 1

            import json
            body = json.loads(report_calls[0].request.body)
            assert body["domain"] == "reliability"
            assert body["score"] == -0.8


class TestOnToolEnd:
    @responses.activate
    def test_reports_tool_completion(self):
        _mock_oracle()
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                oracle_url=ORACLE_URL,
                keys_dir=tmpdir,
            )
            handler.on_tool_end(
                output="search results",
                run_id=uuid.uuid4(),
                parent_run_id=uuid.uuid4(),
                name="search-tool",
            )

            report_calls = [c for c in responses.calls if "/v1/reports" in c.request.url]
            assert len(report_calls) == 1


class TestOnRetrieverEnd:
    @responses.activate
    def test_reports_retriever_with_docs(self):
        _mock_oracle()
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                oracle_url=ORACLE_URL,
                keys_dir=tmpdir,
            )
            from langchain_core.documents import Document
            handler.on_retriever_end(
                documents=[Document(page_content="relevant doc")],
                run_id=uuid.uuid4(),
                parent_run_id=uuid.uuid4(),
                name="my-retriever",
            )

            report_calls = [c for c in responses.calls if "/v1/reports" in c.request.url]
            assert len(report_calls) == 1

            import json
            body = json.loads(report_calls[0].request.body)
            assert body["domain"] == "information_quality"
            assert body["score"] == 0.7


class TestNamespacing:
    def test_node_identities_namespaced_by_graph(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            h1 = NoSocialCallbackHandler(keys_dir=tmpdir, graph_name="graph-a", auto_register=False)
            h2 = NoSocialCallbackHandler(keys_dir=tmpdir, graph_name="graph-b", auto_register=False)
            id1 = h1._get_or_create_identity("graph-a:researcher")
            id2 = h2._get_or_create_identity("graph-b:researcher")
            assert id1.did != id2.did

    def test_identity_reused_across_calls(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(keys_dir=tmpdir, auto_register=False)
            id1 = handler._get_or_create_identity("node-a")
            id2 = handler._get_or_create_identity("node-a")
            assert id1.did == id2.did


class TestAlreadyRegistered:
    @responses.activate
    def test_handles_409_already_registered(self):
        """Handler should treat 409 as successful registration."""
        responses.post(
            f"{ORACLE_URL}/v1/agents/challenge",
            json={"error": "Already registered"},
            status=409,
        )
        responses.post(
            f"{ORACLE_URL}/v1/reports",
            json={"accepted": True},
            status=201,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            handler = NoSocialCallbackHandler(
                oracle_url=ORACLE_URL,
                keys_dir=tmpdir,
            )
            handler.on_chain_end(
                outputs={"result": "done"},
                run_id=uuid.uuid4(),
                parent_run_id=uuid.uuid4(),
                name="my-node",
            )

            report_calls = [c for c in responses.calls if "/v1/reports" in c.request.url]
            assert len(report_calls) == 1
