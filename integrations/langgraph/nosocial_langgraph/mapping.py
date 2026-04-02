"""
Event-to-report mapping for LangChain/LangGraph callbacks.

Maps LangChain callback events to NoSocial report parameters (domain + score).
"""

def map_chain_end(outputs: dict) -> tuple[str, float, dict]:
    """Map on_chain_end to a NoSocial report."""
    has_output = bool(outputs) and any(
        v is not None and v != "" for v in (outputs.values() if isinstance(outputs, dict) else [outputs])
    )
    score = 0.8 if has_output else -0.5
    return (
        "task_completion",
        score,
        {"taskType": "langgraph-node", "outputAccepted": has_output},
    )


def map_chain_error(error: Exception) -> tuple[str, float, dict]:
    """Map on_chain_error to a NoSocial report."""
    return (
        "reliability",
        -0.8,
        {"taskType": "langgraph-node", "error": type(error).__name__},
    )


def map_tool_end(output: str) -> tuple[str, float, dict]:
    """Map on_tool_end to a NoSocial report."""
    has_output = bool(output and str(output).strip())
    score = 0.8 if has_output else -0.5
    return (
        "task_completion",
        score,
        {"taskType": "langgraph-tool", "outputAccepted": has_output},
    )


def map_retriever_end(documents: list) -> tuple[str, float, dict]:
    """Map on_retriever_end to a NoSocial report."""
    has_docs = bool(documents) and len(documents) > 0
    score = 0.7 if has_docs else -0.3
    return (
        "information_quality",
        score,
        {"taskType": "langgraph-retriever", "docCount": len(documents) if documents else 0},
    )
