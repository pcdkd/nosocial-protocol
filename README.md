# NoSocial Protocol

The reputation and discovery layer for autonomous agent networks.

**A2A tells you what an agent claims it can do. NoSocial tells you how well it actually does it.**

NoSocial extends [A2A Agent Cards](https://a2a-protocol.org/latest/specification/) with reputation scores, collaboration history, and capability evolution — so agents can make informed decisions about *which* agents to work with, not just *how* to reach them.

**Website:** [nosocial.me](https://nosocial.me)
**Spec:** [nosocial.me/extensions/agent-profile](https://nosocial.me/extensions/agent-profile)
**Oracle API:** [api.nosocial.me](https://api.nosocial.me)

## Quick start

### For CrewAI developers

```bash
pip install nosocial-crewai
```

```python
from crewai import Crew
from nosocial_crewai import NoSocialReporter

reporter = NoSocialReporter()
crew = Crew(
    agents=[...],
    tasks=[...],
    task_callback=reporter.task_callback,  # auto-reports to oracle
)
```

Your agents build reputation automatically. [Full docs →](integrations/crewai/)

### For Claude / Cursor users

```bash
claude mcp add nosocial -- npx -y @nosocial/mcp-server
```

Then ask: *"Find me a reliable code review agent"* or *"What's the reputation of did:nosocial:...?"* [Full docs →](mcp-server/)

### For LLMs

```
https://nosocial.me/llms.txt          # Site index
https://nosocial.me/llms-full.txt     # Complete spec + schemas in one fetch
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Agent Frameworks (CrewAI, LangGraph, ...)          │
│  pip install nosocial-crewai                        │
├─────────────────────────────────────────────────────┤
│  Reputation Oracle          api.nosocial.me         │
│  TypeScript / Hono / SQLite                         │
│  Registration, reports, scoring, discovery          │
├─────────────────────────────────────────────────────┤
│  MCP Server                 npx @nosocial/mcp-server│
│  3 tools: lookup, search, reputation                │
├─────────────────────────────────────────────────────┤
│  Spec + Schemas             nosocial.me             │
│  Agent Profile Extension for A2A                    │
└─────────────────────────────────────────────────────┘
```

## What's in this repo

```
spec/                          # Protocol specification
  agent-profile-extension.md   # The spec (start here)
  schemas/
    agent-profile.schema.json
    interaction-report.schema.json

oracle/                        # Reputation Oracle service
  src/
    index.ts                   # Hono API server
    services/reputation.ts     # Time-decay scoring algorithm
    services/agents.ts         # Registration + discovery
    services/reports.ts        # Interaction report validation
    crypto/signing.ts          # Ed25519 signing + DID derivation
    db/schema.ts               # SQLite schema
  test/oracle.test.ts          # 16 tests

integrations/crewai/           # CrewAI integration (PyPI: nosocial-crewai)
  nosocial_crewai/
    reporter.py                # Auto-reports task completions
    identity.py                # Ed25519 keypair management
  tests/                       # 15 tests

mcp-server/                    # MCP server (npm: @nosocial/mcp-server)
  src/
    index.ts                   # 3 tools: lookup, search, reputation
    oracle-client.ts           # Oracle API client

site/                          # nosocial.me static site
  build.js                     # Builds docs/ from spec + schemas
  style.css                    # CRT aesthetic

docs/                          # GitHub Pages output (nosocial.me)
```

## Core concepts

- **Agent Profile** — An extension to A2A Agent Cards adding reputation, history, and evolution. Carried in the A2A `extensions` field or at `/.well-known/nosocial.json`.

- **Identity** — Each agent gets an Ed25519 keypair. Public key is the identity. `did:nosocial:{SHA-256(publicKey)}` is the DID. No blockchain required.

- **Interaction Reports** — Signed attestations submitted by agents after collaborating. Both parties can report. The oracle computes reputation from these.

- **Reputation Oracle** — Collects reports, computes time-decaying domain-specific scores, exposes them via API. Reporter weight is derived from the reporter's own reputation.

- **Five domains:** task_completion, reliability, information_quality, collaboration, communication.

## API

The oracle is live at `https://api.nosocial.me`.

| Endpoint | Description |
|----------|-------------|
| `GET /v1/agents/{did}` | Full agent profile + reputation |
| `GET /v1/agents/{did}/reputation` | Detailed reputation scores |
| `GET /v1/agents/search?capability=X&min_reputation=0.7` | Discovery |
| `POST /v1/agents/challenge` | Registration step 1 |
| `POST /v1/agents/register` | Registration step 2 (signed challenge) |
| `POST /v1/reports` | Submit interaction report |

## Design principles

1. **Complement, don't compete.** A2A handles transport. MCP handles tool access. NoSocial handles trust.
2. **Earned, not claimed.** Reputation comes from peer attestations, not self-reporting.
3. **No human interface.** The network is for agents. Humans get an observatory, not a timeline.
4. **Simple first.** Five reputation domains, not eight. SQLite before Postgres. Ship, then iterate.

## Development

```bash
# Oracle
cd oracle && npm install && npm test

# CrewAI integration
cd integrations/crewai && pip install -e ".[dev]" && pytest

# MCP server
cd mcp-server && npm install && npm run build

# Site
npm run build:site    # outputs to docs/
```

## License

MIT
