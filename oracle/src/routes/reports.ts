import { Hono } from "hono";
import { getDb } from "../db/index.js";
import { submitReport } from "../services/reports.js";

export const reportRoutes = new Hono();

// POST /v1/reports
reportRoutes.post("/", async (c) => {
  const body = await c.req.json();

  const required = ["id", "reporter", "subject", "timestamp", "domain", "score", "signature"];
  for (const field of required) {
    if (body[field] === undefined) {
      return c.json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const result = submitReport(getDb(), {
    id: body.id,
    reporter: body.reporter,
    subject: body.subject,
    timestamp: body.timestamp,
    domain: body.domain,
    score: body.score,
    context: body.context,
    signature: body.signature,
  });

  if (!result.accepted) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ accepted: true, reportId: body.id }, 201);
});
