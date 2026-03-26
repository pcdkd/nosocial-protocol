"""Tests for NoSocial CrewAI reporter."""

import tempfile
from dataclasses import dataclass
from typing import Optional
from unittest.mock import MagicMock, patch

import responses

from nosocial_crewai.reporter import NoSocialReporter


@dataclass
class FakeTaskOutput:
    """Mimics CrewAI's TaskOutput for testing."""
    description: str = "Test task"
    raw: str = "Task completed successfully"
    agent: Optional[str] = "researcher"


class TestReporterInit:
    def test_creates_crew_identity(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = NoSocialReporter(
                keys_dir=tmpdir,
                auto_register=False,
            )
            assert reporter._crew_identity.did.startswith("did:nosocial:")

    def test_crew_identity_persists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            r1 = NoSocialReporter(keys_dir=tmpdir, crew_name="test", auto_register=False)
            r2 = NoSocialReporter(keys_dir=tmpdir, crew_name="test", auto_register=False)
            assert r1._crew_identity.did == r2._crew_identity.did


class TestReporterCallback:
    @responses.activate
    def test_task_callback_registers_and_reports(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            oracle_url = "http://test-oracle:3000"

            # Mock challenge endpoint
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

            # Mock register endpoint
            responses.post(
                f"{oracle_url}/v1/agents/register",
                json={"did": "did:nosocial:abc", "name": "test"},
                status=201,
            )

            # Mock report endpoint
            responses.post(
                f"{oracle_url}/v1/reports",
                json={"accepted": True},
                status=201,
            )

            reporter = NoSocialReporter(
                oracle_url=oracle_url,
                keys_dir=tmpdir,
                auto_register=True,
            )

            output = FakeTaskOutput(
                description="Research AI trends",
                raw="Found 5 major trends in AI.",
                agent="researcher",
            )

            reporter.task_callback(output)

            # Should have called: 2 challenges + 2 registers + 2 reports
            # (crew identity + agent identity, then task_completion + reliability)
            report_calls = [
                c for c in responses.calls if "/v1/reports" in c.request.url
            ]
            assert len(report_calls) == 2  # task_completion + reliability

    def test_skips_when_no_agent(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = NoSocialReporter(
                keys_dir=tmpdir,
                auto_register=False,
            )
            output = FakeTaskOutput(agent=None)
            # Should not raise
            reporter.task_callback(output)

    @responses.activate
    def test_reports_negative_score_for_empty_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            oracle_url = "http://test-oracle:3000"

            # Mock endpoints — return 409 for already registered
            responses.post(
                f"{oracle_url}/v1/agents/challenge",
                json={"error": "Already registered"},
                status=409,
            )

            responses.post(
                f"{oracle_url}/v1/reports",
                json={"accepted": True},
                status=201,
            )

            reporter = NoSocialReporter(
                oracle_url=oracle_url,
                keys_dir=tmpdir,
            )

            output = FakeTaskOutput(raw="", agent="writer")
            reporter.task_callback(output)

            # Only task_completion report (no reliability for empty output)
            report_calls = [
                c for c in responses.calls if "/v1/reports" in c.request.url
            ]
            assert len(report_calls) == 1

    def test_agent_identity_reused_across_tasks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            reporter = NoSocialReporter(
                keys_dir=tmpdir,
                auto_register=False,
            )
            id1 = reporter._get_or_create_identity("researcher")
            id2 = reporter._get_or_create_identity("researcher")
            assert id1.did == id2.did
