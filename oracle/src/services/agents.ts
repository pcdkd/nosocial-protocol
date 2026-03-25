import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { deriveDid, verifySignature } from "../crypto/signing.js";

export interface RegisterRequest {
  publicKey: string; // "ed25519:{base64url}"
  name?: string;
  endpoint?: string;
  a2aCardUrl?: string;
  operator?: {
    name?: string;
    contact?: string;
    homepage?: string;
  };
  skills?: Array<{ id: string; name?: string }>;
}

export interface ChallengeResult {
  challengeId: string;
  challenge: string;
  did: string;
  expiresAt: string;
}

export interface Agent {
  did: string;
  publicKey: string;
  name: string | null;
  endpoint: string | null;
  a2aCardUrl: string | null;
  registeredAt: string;
  skills: Array<{ id: string; name: string | null }>;
}

/**
 * Step 1 of registration: create a challenge for the agent to sign.
 */
export function createChallenge(
  db: Database.Database,
  req: RegisterRequest
): ChallengeResult {
  const did = deriveDid(req.publicKey);

  // Check if agent already exists
  const existing = db
    .prepare<[string], { did: string }>("SELECT did FROM agents WHERE did = ?")
    .get(did);
  if (existing) {
    throw new Error("Agent already registered");
  }

  const challengeId = uuidv4();
  const challenge = uuidv4(); // random string to sign
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString(); // 5 min

  db.prepare(
    "INSERT INTO challenges (id, agent_did, challenge, expires_at) VALUES (?, ?, ?, ?)"
  ).run(challengeId, did, challenge, expiresAt);

  return { challengeId, challenge, did, expiresAt };
}

/**
 * Step 2 of registration: verify the signed challenge and create the agent.
 */
export function verifyAndRegister(
  db: Database.Database,
  challengeId: string,
  signature: string,
  req: RegisterRequest
): Agent {
  const challenge = db
    .prepare<
      [string],
      { challenge: string; agent_did: string; expires_at: string }
    >("SELECT challenge, agent_did, expires_at FROM challenges WHERE id = ?")
    .get(challengeId);

  if (!challenge) throw new Error("Challenge not found");
  if (new Date(challenge.expires_at) < new Date())
    throw new Error("Challenge expired");

  const did = deriveDid(req.publicKey);
  if (did !== challenge.agent_did)
    throw new Error("DID mismatch");

  // Verify signature over the challenge string
  const valid = verifySignature(
    { challenge: challenge.challenge },
    signature,
    req.publicKey
  );
  if (!valid) throw new Error("Invalid signature");

  // Create agent
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO agents (did, public_key, name, endpoint, a2a_card_url, operator_name, operator_contact, operator_homepage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      did,
      req.publicKey,
      req.name ?? null,
      req.endpoint ?? null,
      req.a2aCardUrl ?? null,
      req.operator?.name ?? null,
      req.operator?.contact ?? null,
      req.operator?.homepage ?? null
    );

    if (req.skills?.length) {
      const insertSkill = db.prepare(
        "INSERT INTO agent_skills (agent_did, skill_id, skill_name) VALUES (?, ?, ?)"
      );
      for (const skill of req.skills) {
        insertSkill.run(did, skill.id, skill.name ?? null);
      }
    }

    // Clean up challenge
    db.prepare("DELETE FROM challenges WHERE id = ?").run(challengeId);
  });
  tx();

  return getAgent(db, did)!;
}

export function getAgent(
  db: Database.Database,
  did: string
): Agent | null {
  const row = db
    .prepare<
      [string],
      {
        did: string;
        public_key: string;
        name: string | null;
        endpoint: string | null;
        a2a_card_url: string | null;
        registered_at: string;
      }
    >("SELECT did, public_key, name, endpoint, a2a_card_url, registered_at FROM agents WHERE did = ?")
    .get(did);

  if (!row) return null;

  const skills = db
    .prepare<[string], { skill_id: string; skill_name: string | null }>(
      "SELECT skill_id, skill_name FROM agent_skills WHERE agent_did = ?"
    )
    .all(did);

  return {
    did: row.did,
    publicKey: row.public_key,
    name: row.name,
    endpoint: row.endpoint,
    a2aCardUrl: row.a2a_card_url,
    registeredAt: row.registered_at,
    skills: skills.map((s) => ({ id: s.skill_id, name: s.skill_name })),
  };
}

export interface SearchParams {
  capability?: string;
  minReputation?: number;
  domain?: string;
  sort?: "reputation" | "recent" | "interactions";
  limit?: number;
}

export function searchAgents(
  db: Database.Database,
  params: SearchParams
): Agent[] {
  // Build query parts and bindings in declaration order to avoid fragile reordering
  const joinParts: string[] = [];
  const joinBindings: unknown[] = [];
  const conditions: string[] = [];
  const whereBindings: unknown[] = [];

  const needsReputation = params.minReputation != null || params.sort === "reputation";

  if (params.capability) {
    joinParts.push("JOIN agent_skills s ON s.agent_did = a.did");
    conditions.push("(s.skill_id LIKE ? OR s.skill_name LIKE ?)");
    const like = `%${params.capability}%`;
    whereBindings.push(like, like);
  }

  if (needsReputation) {
    joinParts.push(
      "LEFT JOIN reputation_cache rc ON rc.agent_did = a.did AND rc.domain = ?"
    );
    joinBindings.push(params.domain || "task_completion");
  }

  if (params.minReputation != null) {
    conditions.push("rc.score >= ?");
    whereBindings.push(params.minReputation);
  }

  let query = `SELECT DISTINCT a.did FROM agents a ${joinParts.join(" ")}`;
  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  switch (params.sort) {
    case "reputation":
      query += " ORDER BY rc.score DESC";
      break;
    case "interactions":
      query += " ORDER BY (SELECT COUNT(*) FROM interaction_reports WHERE subject_did = a.did) DESC";
      break;
    case "recent":
    default:
      query += " ORDER BY a.registered_at DESC";
      break;
  }

  const limit = Math.min(params.limit || 20, 100);
  query += ` LIMIT ${limit}`;

  // Bindings: join params first (they appear first in the SQL), then WHERE params
  const bindings = [...joinBindings, ...whereBindings];
  const rows = db.prepare(query).all(...bindings) as Array<{ did: string }>;
  return rows.map((r) => getAgent(db, r.did)!).filter(Boolean);
}
