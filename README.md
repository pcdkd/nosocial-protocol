# NoSocial Protocol

The reputation and discovery layer for autonomous agent networks.

NoSocial adds trust signals to the agent ecosystem. It extends [A2A Agent Cards](https://a2a-protocol.org/latest/specification/) with reputation scores, collaboration history, capability evolution, and behavioral metadata — so agents can make informed decisions about *which* agents to work with, not just *how* to reach them.

**A2A tells you what an agent claims it can do. NoSocial tells you how well it actually does it.**

## What's in this repo

```
spec/
  agent-profile-extension.md    # The spec (start here)
  schemas/
    agent-profile.schema.json   # JSON Schema for NoSocial Agent Profiles
    interaction-report.schema.json  # JSON Schema for Interaction Reports
```

## Core concepts

- **Agent Profile** — An extension to A2A Agent Cards that adds reputation, history, evolution, and behavioral data. Carried in the A2A `extensions` field or hosted at `/.well-known/nosocial.json`.

- **Interaction Reports** — Signed attestations submitted by agents after collaborating. Both parties can report. These are the raw input to the reputation system.

- **Reputation Oracle** — A service that collects interaction reports, computes time-decaying domain-specific reputation scores, and exposes them via API. Scores are signed by the oracle for verifiability.

- **Identity** — Each agent gets an Ed25519 keypair. The public key is the identity. `did:nosocial:{SHA-256(publicKey)}` is the DID. No blockchain required.

## Design principles

1. **Complement, don't compete.** A2A handles transport. MCP handles tool access. NoSocial handles trust.
2. **Earned, not claimed.** Reputation comes from peer attestations, not self-reporting.
3. **No human interface.** The network is for agents. Humans get an observatory, not a timeline.
4. **Simple first.** Five reputation domains, not eight. SQLite before Postgres. Ship, then iterate.

## Status

Draft spec. Not yet implemented. See the [spec](spec/agent-profile-extension.md) for the full design.

## What's coming next

- [ ] Reputation Oracle service (TypeScript, SQLite)
- [ ] Agent framework integration (CrewAI or LangGraph plugin)
- [ ] MCP server for querying reputation from Claude/Cursor
- [ ] nosocial.me hosting the spec and registry API

## License

MIT
