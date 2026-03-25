import { Hono } from "hono";
import { getDb } from "../db/index.js";
import {
  createChallenge,
  verifyAndRegister,
  getAgent,
  searchAgents,
} from "../services/agents.js";
import { computeReputation } from "../services/reputation.js";

export const agentRoutes = new Hono();

// POST /v1/agents/challenge — Step 1: request a challenge
agentRoutes.post("/challenge", async (c) => {
  const body = await c.req.json();
  if (!body.publicKey) {
    return c.json({ error: "publicKey is required" }, 400);
  }

  try {
    const result = createChallenge(getDb(), body);
    return c.json(result, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return c.json({ error: msg }, 409);
  }
});

// POST /v1/agents/register — Step 2: submit signed challenge
agentRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  if (!body.challengeId || !body.signature || !body.publicKey) {
    return c.json(
      { error: "challengeId, signature, and publicKey are required" },
      400
    );
  }

  try {
    const agent = verifyAndRegister(
      getDb(),
      body.challengeId,
      body.signature,
      body
    );
    return c.json(agent, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("not found") || msg.includes("expired") ? 404 : 400;
    return c.json({ error: msg }, status);
  }
});

// GET /v1/agents/search
agentRoutes.get("/search", (c) => {
  const params = {
    capability: c.req.query("capability"),
    minReputation: c.req.query("min_reputation")
      ? parseFloat(c.req.query("min_reputation")!)
      : undefined,
    domain: c.req.query("domain"),
    sort: c.req.query("sort") as "reputation" | "recent" | "interactions" | undefined,
    limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
  };

  const agents = searchAgents(getDb(), params);

  // Attach reputation summaries
  const results = agents.map((a) => {
    const rep = computeReputation(getDb(), a.did);
    return {
      did: a.did,
      name: a.name,
      skills: a.skills.map((s) => s.id),
      reputation: rep
        ? {
            overall: {
              score: rep.overall.score,
              confidence: rep.overall.confidence,
            },
            ...(params.domain && rep.domains[params.domain]
              ? {
                  [params.domain]: {
                    score: rep.domains[params.domain]!.score,
                    confidence: rep.domains[params.domain]!.confidence,
                  },
                }
              : {}),
          }
        : null,
      serviceEndpoint: a.endpoint,
      a2aCard: a.a2aCardUrl,
    };
  });

  return c.json({
    agents: results,
    total: results.length,
    hasMore: false, // TODO: pagination
  });
});

// GET /v1/agents/:did
agentRoutes.get("/:did", (c) => {
  const did = c.req.param("did");
  const agent = getAgent(getDb(), did);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const reputation = computeReputation(getDb(), did);

  return c.json({
    ...agent,
    reputation,
  });
});

// GET /v1/agents/:did/reputation
agentRoutes.get("/:did/reputation", (c) => {
  const did = c.req.param("did");
  const agent = getAgent(getDb(), did);
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const reputation = computeReputation(getDb(), did);
  if (!reputation) {
    return c.json({ error: "No reputation data" }, 404);
  }

  return c.json(reputation);
});
