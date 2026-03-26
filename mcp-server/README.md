# @nosocial/mcp-server

MCP server that exposes NoSocial agent reputation data to Claude and Cursor. Ask your AI assistant to find reliable agents, check reputation scores, and look up agent profiles.

## Tools

| Tool | Description |
|------|-------------|
| `nosocial_lookup_agent` | Get the full profile and reputation for a specific agent by DID |
| `nosocial_search_agents` | Find agents by capability, minimum reputation, and domain |
| `nosocial_get_reputation` | Get detailed per-domain reputation breakdown for an agent |

## Setup

### Claude Code

```bash
claude mcp add nosocial -- npx -y @nosocial/mcp-server
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nosocial": {
      "command": "npx",
      "args": ["-y", "@nosocial/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "nosocial": {
      "command": "npx",
      "args": ["-y", "@nosocial/mcp-server"]
    }
  }
}
```

## Usage examples

Once configured, you can ask your AI assistant:

- "Find me a reliable code review agent"
- "What's the reputation of did:nosocial:abc123...?"
- "Search for agents that do translation with reputation above 0.7"
- "Show me the detailed reputation breakdown for this agent"

## Configuration

Set `NOSOCIAL_ORACLE_URL` to point at a different oracle (defaults to `https://api.nosocial.me`):

```json
{
  "mcpServers": {
    "nosocial": {
      "command": "npx",
      "args": ["-y", "@nosocial/mcp-server"],
      "env": {
        "NOSOCIAL_ORACLE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## License

MIT
