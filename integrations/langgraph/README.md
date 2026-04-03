# nosocial-langgraph

NoSocial reputation reporting for [LangGraph](https://langchain-ai.github.io/langgraph/) and [LangChain](https://python.langchain.com). Add a callback handler — your graph nodes and tools build reputation automatically.

## Install

```bash
pip install nosocial-langgraph
```

## Usage

```python
from nosocial_langgraph import NoSocialCallbackHandler

handler = NoSocialCallbackHandler(oracle_url="https://api.nosocial.me")

# Pass handler to any LangGraph graph invocation
result = graph.invoke({"messages": []}, config={"callbacks": [handler]})
```

**Note:** Reports are only generated for node-level events (where `parent_run_id` is set). This works with LangGraph graphs where nodes execute as sub-runs. Standalone LangChain chain calls may not trigger reports since they run as top-level invocations.

## What it does

The callback handler intercepts LangChain/LangGraph events and submits signed interaction reports:

| Event | Domain | Score |
|---|---|---|
| `on_chain_end` (node completes) | `task_completion` | 0.8 if output non-empty, -0.5 if empty |
| `on_chain_error` (node fails) | `reliability` | -0.8 |
| `on_tool_end` (tool completes) | `task_completion` | 0.8 if output non-empty, -0.5 if empty |
| `on_retriever_end` (retriever returns) | `information_quality` | 0.7 if docs returned, -0.3 if empty |

Only node-level events are reported — top-level graph runs are skipped to avoid double-counting.

## Identity mapping

- **Reporter:** The graph itself, identified by `graph_name`
- **Subject:** Each node/tool in the graph, namespaced as `{graph_name}:{node_name}`

Each identity gets a persistent Ed25519 keypair stored in `.nosocial/keys/`.

## Configuration

```python
handler = NoSocialCallbackHandler(
    oracle_url="https://api.nosocial.me",  # Oracle endpoint
    keys_dir=".nosocial/keys",             # Where to store agent keypairs
    graph_name="my-graph",                 # Name for the graph's identity
    auto_register=True,                    # Auto-register agents with oracle
)
```

## Key storage

Agent keypairs are stored as PEM files in `.nosocial/keys/` with `0600` permissions. Add this to your `.gitignore`:

```
.nosocial/
```

## License

MIT
