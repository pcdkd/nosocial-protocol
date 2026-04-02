import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { agentRoutes } from "./routes/agents.js";
import { reportRoutes } from "./routes/reports.js";
import { statsRoutes } from "./routes/stats.js";
import { getDb } from "./db/index.js";
import { shutdownAnalytics } from "./analytics.js";
import { serve } from "@hono/node-server";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/", (c) =>
  c.json({
    name: "NoSocial Reputation Oracle",
    version: "0.1.0",
    spec: "https://nosocial.me/extensions/agent-profile",
  })
);

app.get("/health", (c) => {
  try {
    getDb().prepare("SELECT 1").get();
    return c.json({ status: "ok" });
  } catch (e) {
    Sentry.captureException(e);
    return c.json({ status: "error" }, 500);
  }
});

// API routes
app.route("/v1/agents", agentRoutes);
app.route("/v1/reports", reportRoutes);
app.route("/v1/stats", statsRoutes);

// Global error handler — catches unhandled errors in routes
app.onError((err, c) => {
  Sentry.captureException(err);
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env.PORT || "3000");

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`NoSocial Oracle running on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close();
  await shutdownAnalytics();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app };
