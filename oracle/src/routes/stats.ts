import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { getDb } from "../db/index.js";

export const statsRoutes = new Hono();

// Require STATS_API_KEY to access stats
const apiKey = process.env.STATS_API_KEY;
if (apiKey) {
  statsRoutes.use("*", bearerAuth({ token: apiKey }));
}

// GET /v1/stats
statsRoutes.get("/", (c) => {
  if (!apiKey) {
    return c.json({ error: "Stats endpoint not configured" }, 503);
  }

  const db = getDb();

  const totalAgents =
    db.prepare("SELECT COUNT(*) as count FROM agents").get() as { count: number };

  const totalReports =
    db.prepare("SELECT COUNT(*) as count FROM interaction_reports").get() as { count: number };

  const reportsLast24h =
    db.prepare(
      "SELECT COUNT(*) as count FROM interaction_reports WHERE received_at > datetime('now', '-1 day')"
    ).get() as { count: number };

  const agentsLast7d =
    db.prepare(
      "SELECT COUNT(*) as count FROM agents WHERE registered_at > datetime('now', '-7 days')"
    ).get() as { count: number };

  const topCapabilities = db
    .prepare(
      "SELECT skill_id, COUNT(*) as count FROM agent_skills GROUP BY skill_id ORDER BY count DESC LIMIT 10"
    )
    .all() as { skill_id: string; count: number }[];

  const reportsByDomain = db
    .prepare(
      "SELECT domain, COUNT(*) as count FROM interaction_reports GROUP BY domain ORDER BY count DESC"
    )
    .all() as { domain: string; count: number }[];

  return c.json({
    agents: {
      total: totalAgents.count,
      last7d: agentsLast7d.count,
    },
    reports: {
      total: totalReports.count,
      last24h: reportsLast24h.count,
      byDomain: Object.fromEntries(reportsByDomain.map((r) => [r.domain, r.count])),
    },
    topCapabilities: topCapabilities.map((c) => ({
      capability: c.skill_id,
      agentCount: c.count,
    })),
  });
});
