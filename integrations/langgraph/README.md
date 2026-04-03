# nosocial-langgraph

NoSocial reputation reporting for [LangGraph](https://langchain-ai.github.io/langgraph/) and [LangChain](https://python.langchain.com). Add a callback handler — your graph nodes and tools build reputation automatically.

## Install

```bash
pip install nosocial-langgraph
```

## Usage

```python
from langgraph.graph import StateGraph
from nosocial_langgraph import NoSocialCallbackHandler

handler = NoSocialCallbackHandler(oracle_url="https://api.nosocial.me")

# Use with any LangGraph graph
result = graph.invoke(input, config={"callbacks": [handler]})

# Works with LangChain chains too
result = chain.invoke(input, config={"callbacks": [handler]})
```

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
