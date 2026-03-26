#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OracleClient } from "./oracle-client.js";

const oracle = new OracleClient(process.env.NOSOCIAL_ORACLE_URL);

const server = new McpServer({
  name: "nosocial",
  version: "0.1.0",
});

// Tool: Look up a specific agent by DID
server.registerTool(
  "nosocial_lookup_agent",
  {
    title: "Look up NoSocial agent",
    description:
      "Get the full profile and reputation scores for a specific agent by its NoSocial DID (did:nosocial:...).",
    inputSchema: z.object({
      did: z.string().describe("The agent's NoSocial DID (e.g., did:nosocial:abc123...)"),
    }),
  },
  async ({ did }) => {
    const agent = await oracle.getAgent(did);
    if (!agent) {
      return {
        content: [{ type: "text" as const, text: `No agent found with DID: ${did}` }],
      };
    }

    const lines = [
      `**${agent.name || "Unnamed Agent"}** (${agent.did})`,
      "",
      `**Registered:** ${agent.registeredAt}`,
      agent.endpoint ? `**Endpoint:** ${agent.endpoint}` : null,
      agent.a2aCardUrl ? `**A2A Card:** ${agent.a2aCardUrl}` : null,
      "",
      `**Skills:** ${agent.skills.map((s) => s.name || s.id).join(", ") || "None listed"}`,
    ].filter(Boolean);

    if (agent.reputation) {
      const r = agent.reputation;
      lines.push(
        "",
        `**Reputation** (${r.overall.totalInteractions} interactions):`,
        `  Overall: ${formatScore(r.overall.score)} (confidence: ${(r.overall.confidence * 100).toFixed(0)}%)`,
      );
      for (const [domain, ds] of Object.entries(r.domains)) {
        lines.push(
          `  ${formatDomain(domain)}: ${formatScore(ds.score)} (${ds.interactionCount} interactions, trend: ${formatTrend(ds.trend)})`,
        );
      }
    } else {
      lines.push("", "**Reputation:** No data yet");
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

// Tool: Search for agents by capability and reputation
server.registerTool(
  "nosocial_search_agents",
  {
    title: "Search NoSocial agents",
    description:
      "Find agents by capability, minimum reputation score, and domain. " +
      "Use this to discover reliable agents for a specific task (e.g., 'find me a code review agent with reputation above 0.7').",
    inputSchema: z.object({
      capability: z
        .string()
        .optional()
        .describe("Skill or capability to search for (e.g., 'code-review', 'translation')"),
      min_reputation: z
        .number()
        .min(-1)
        .max(1)
        .optional()
        .describe("Minimum reputation score (-1.0 to 1.0)"),
      domain: z
        .enum([
          "task_completion",
          "reliability",
          "information_quality",
          "collaboration",
          "communication",
        ])
        .optional()
        .describe("Reputation domain to filter/sort by"),
      sort: z
        .enum(["reputation", "recent", "interactions"])
        .optional()
        .describe("How to sort results (default: recent)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return (default: 10)"),
    }),
  },
  async (params) => {
    const result = await oracle.searchAgents({
      capability: params.capability,
      minReputation: params.min_reputation,
      domain: params.domain,
      sort: params.sort,
      limit: params.limit || 10,
    });

    if (result.agents.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No agents found matching your criteria." }],
      };
    }

    const lines = [`Found ${result.total} agent(s):`, ""];

    for (const agent of result.agents) {
      const rep = agent.reputation as Record<string, Record<string, number>> | null;
      const overall = rep?.overall;
      const score = overall?.score != null ? formatScore(overall.score) : "no data";

      lines.push(
        `- **${agent.name || "Unnamed"}** (${agent.did})`,
        `  Skills: ${agent.skills.join(", ") || "none"}`,
        `  Reputation: ${score}`,
        agent.serviceEndpoint ? `  Endpoint: ${agent.serviceEndpoint}` : "",
        "",
      );
    }

    return {
      content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
    };
  },
);

// Tool: Get detailed reputation for an agent
server.registerTool(
  "nosocial_get_reputation",
  {
    title: "Get agent reputation details",
    description:
      "Get detailed reputation scores across all domains for a specific agent. " +
      "Shows per-domain scores, confidence levels, interaction counts, and trends.",
    inputSchema: z.object({
      did: z.string().describe("The agent's NoSocial DID"),
    }),
  },
  async ({ did }) => {
    const rep = await oracle.getReputation(did);
    if (!rep) {
      return {
        content: [
          { type: "text" as const, text: `No reputation data for agent: ${did}` },
        ],
      };
    }

    const lines = [
      `**Reputation for ${did}**`,
      "",
      `**Overall:** ${formatScore(rep.overall.score)} (confidence: ${(rep.overall.confidence * 100).toFixed(0)}%, ${rep.overall.totalInteractions} total interactions)`,
      `**Last updated:** ${rep.overall.updatedAt}`,
      "",
      "**Domain scores:**",
    ];

    for (const [domain, ds] of Object.entries(rep.domains)) {
      lines.push(
        `  ${formatDomain(domain)}:`,
        `    Score: ${formatScore(ds.score)}`,
        `    Confidence: ${(ds.confidence * 100).toFixed(0)}%`,
        `    Interactions: ${ds.interactionCount}`,
        `    Trend (30d): ${formatTrend(ds.trend)}`,
      );
    }

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

// Helpers

function formatScore(score: number): string {
  const pct = (score * 100).toFixed(0);
  if (score >= 0.7) return `${pct}/100 (excellent)`;
  if (score >= 0.4) return `${pct}/100 (good)`;
  if (score >= 0) return `${pct}/100 (fair)`;
  return `${pct}/100 (poor)`;
}

function formatTrend(trend: number): string {
  if (trend > 0.05) return `↑ improving (+${(trend * 100).toFixed(1)}%)`;
  if (trend < -0.05) return `↓ declining (${(trend * 100).toFixed(1)}%)`;
  return "→ stable";
}

function formatDomain(domain: string): string {
  return domain
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Start

const transport = new StdioServerTransport();
await server.connect(transport);
