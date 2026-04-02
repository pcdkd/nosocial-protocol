"""Tests for event-to-report mapping."""

from nosocial_langgraph.mapping import (
    map_chain_end,
    map_chain_error,
    map_retriever_end,
    map_tool_end,
)


class TestMapChainEnd:
    def test_non_empty_output(self):
        domain, score, ctx = map_chain_end({"result": "hello"})
        assert domain == "task_completion"
        assert score == 0.8
        assert ctx["outputAccepted"] is True

    def test_empty_output(self):
        domain, score, ctx = map_chain_end({})
        assert domain == "task_completion"
        assert score == -0.5
        assert ctx["outputAccepted"] is False

    def test_none_values(self):
        domain, score, ctx = map_chain_end({"result": None})
        assert score == -0.5

    def test_empty_string_value(self):
        domain, score, ctx = map_chain_end({"result": ""})
        assert score == -0.5


class TestMapChainError:
    def test_error_report(self):
        domain, score, ctx = map_chain_error(ValueError("test"))
        assert domain == "reliability"
        assert score == -0.8
        assert ctx["error"] == "ValueError"


class TestMapToolEnd:
    def test_non_empty_output(self):
        domain, score, ctx = map_tool_end("search results here")
        assert domain == "task_completion"
        assert score == 0.8

    def test_empty_output(self):
        domain, score, ctx = map_tool_end("")
        assert score == -0.5

    def test_whitespace_only(self):
        domain, score, ctx = map_tool_end("   ")
        assert score == -0.5


class TestMapRetrieverEnd:
    def test_docs_returned(self):
        domain, score, ctx = map_retriever_end([{"page_content": "doc1"}])
        assert domain == "information_quality"
        assert score == 0.7
        assert ctx["docCount"] == 1

    def test_no_docs(self):
        domain, score, ctx = map_retriever_end([])
        assert score == -0.3
        assert ctx["docCount"] == 0

    def test_none_docs(self):
        domain, score, ctx = map_retriever_end(None)
        assert score == -0.3
