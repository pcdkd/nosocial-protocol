import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { createTables } from "../src/db/schema.js";
import {
  generateKeypair,
  base64urlEncode,
  sign,
  deriveDid,
} from "../src/crypto/signing.js";
import {
  createChallenge,
  verifyAndRegister,
  getAgent,
  searchAgents,
} from "../src/services/agents.js";
import { submitReport } from "../src/services/reports.js";
import { computeReputation } from "../src/services/reputation.js";
import { v4 as uuidv4 } from "uuid";

let db: Database.Database;

function makeAgent() {
  const { publicKey, privateKey } = generateKeypair();
  const publicKeyStr = `ed25519:${base64urlEncode(publicKey)}`;
  const did = deriveDid(publicKeyStr);
  return { publicKey, privateKey, publicKeyStr, did };
}

function registerAgent(
  agent: ReturnType<typeof makeAgent>,
  opts?: { name?: string; skills?: Array<{ id: string; name?: string }> }
) {
  const req = {
    publicKey: agent.publicKeyStr,
    name: opts?.name || "TestAgent",
    skills: opts?.skills || [{ id: "test-skill", name: "Test Skill" }],
  };

  const challenge = createChallenge(db, req);
  const signature = sign({ challenge: challenge.challenge }, agent.privateKey);
  return verifyAndRegister(db, challenge.challengeId, signature, req);
}

function submitInteraction(
  reporter: ReturnType<typeof makeAgent>,
  subjectDid: string,
  domain: string,
  score: number
) {
  const report = {
    id: uuidv4(),
    reporter: reporter.did,
    subject: subjectDid,
    timestamp: new Date().toISOString(),
    domain,
    score,
  };

  const signature = sign(report as Record<string, unknown>, reporter.privateKey);
  return submitReport(db, { ...report, signature });
}

beforeAll(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  createTables(db);
});

afterAll(() => {
  db.close();
});

describe("Agent Registration", () => {
  it("registers an agent via challenge-response", () => {
    const agent = makeAgent();
    const registered = registerAgent(agent, { name: "Alice" });

    expect(registered.did).toBe(agent.did);
    expect(registered.name).toBe("Alice");
    expect(registered.skills).toHaveLength(1);
    expect(registered.skills[0].id).toBe("test-skill");
  });

  it("rejects duplicate registration", () => {
    const agent = makeAgent();
    registerAgent(agent);

    expect(() => registerAgent(agent)).toThrow("already registered");
  });

  it("rejects invalid signature", () => {
    const agent = makeAgent();
    const other = makeAgent();
    const req = { publicKey: agent.publicKeyStr, name: "Bad" };
    const challenge = createChallenge(db, req);

    // Sign with wrong key
    const badSig = sign({ challenge: challenge.challenge }, other.privateKey);

    expect(() =>
      verifyAndRegister(db, challenge.challengeId, badSig, req)
    ).toThrow("Invalid signature");
  });

  it("retrieves an agent by DID", () => {
    const agent = makeAgent();
    registerAgent(agent, { name: "Bob" });

    const fetched = getAgent(db, agent.did);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Bob");
  });
});

describe("Interaction Reports", () => {
  it("accepts a valid report", () => {
    const reporter = makeAgent();
    const subject = makeAgent();
    registerAgent(reporter);
    registerAgent(subject);

    const result = submitInteraction(reporter, subject.did, "task_completion", 0.9);
    expect(result.accepted).toBe(true);
  });

  it("rejects self-attestation", () => {
    const agent = makeAgent();
    registerAgent(agent);

    const result = submitInteraction(agent, agent.did, "task_completion", 1.0);
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("yourself");
  });

  it("rejects invalid domain", () => {
    const reporter = makeAgent();
    const subject = makeAgent();
    registerAgent(reporter);
    registerAgent(subject);

    const result = submitInteraction(reporter, subject.did, "bogus_domain", 0.5);
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Invalid domain");
  });

  it("rejects out-of-range score", () => {
    const reporter = makeAgent();
    const subject = makeAgent();
    registerAgent(reporter);
    registerAgent(subject);

    const result = submitInteraction(reporter, subject.did, "reliability", 2.0);
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Score must be");
  });

  it("rejects unregistered reporter", () => {
    const reporter = makeAgent();
    const subject = makeAgent();
    registerAgent(subject);

    const report = {
      id: uuidv4(),
      reporter: reporter.did,
      subject: subject.did,
      timestamp: new Date().toISOString(),
      domain: "reliability",
      score: 0.5,
    };
    const signature = sign(report as Record<string, unknown>, reporter.privateKey);
    const result = submitReport(db, { ...report, signature });

    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Reporter not registered");
  });

  it("rate limits reports per pair", () => {
    const reporter = makeAgent();
    const subject = makeAgent();
    registerAgent(reporter);
    registerAgent(subject);

    // Submit 5 (the max per window)
    for (let i = 0; i < 5; i++) {
      const result = submitInteraction(reporter, subject.did, "task_completion", 0.8);
      expect(result.accepted).toBe(true);
    }

    // 6th should be rate limited
    const result = submitInteraction(reporter, subject.did, "task_completion", 0.8);
    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Rate limited");
  });
});

describe("Reputation Computation", () => {
  it("returns null with no interactions", () => {
    const agent = makeAgent();
    registerAgent(agent);

    const rep = computeReputation(db, agent.did);
    expect(rep).toBeNull();
  });

  it("does not publish domain score below 3 interactions", () => {
    const subject = makeAgent();
    registerAgent(subject);

    // Submit 2 reports from different reporters
    for (let i = 0; i < 2; i++) {
      const reporter = makeAgent();
      registerAgent(reporter);
      submitInteraction(reporter, subject.did, "reliability", 0.9);
    }

    const rep = computeReputation(db, subject.did);
    // Should have interactions but no domain score for reliability
    expect(rep).not.toBeNull();
    expect(rep!.domains["reliability"]).toBeUndefined();
  });

  it("computes domain score with 3+ interactions", () => {
    const subject = makeAgent();
    registerAgent(subject);

    const reporters: ReturnType<typeof makeAgent>[] = [];
    for (let i = 0; i < 4; i++) {
      const reporter = makeAgent();
      registerAgent(reporter);
      reporters.push(reporter);
      submitInteraction(reporter, subject.did, "task_completion", 0.8);
    }

    const rep = computeReputation(db, subject.did);
    expect(rep).not.toBeNull();
    expect(rep!.domains["task_completion"]).toBeDefined();
    expect(rep!.domains["task_completion"]!.score).toBeGreaterThan(0);
    expect(rep!.domains["task_completion"]!.interactionCount).toBe(4);
    expect(rep!.domains["task_completion"]!.confidence).toBe(0.2); // 4/20
  });

  it("computes overall score as weighted average of domains", () => {
    const subject = makeAgent();
    registerAgent(subject);

    // Submit 3+ reports in two domains
    for (let i = 0; i < 3; i++) {
      const r1 = makeAgent();
      const r2 = makeAgent();
      registerAgent(r1);
      registerAgent(r2);
      submitInteraction(r1, subject.did, "task_completion", 0.9);
      submitInteraction(r2, subject.did, "reliability", 0.7);
    }

    const rep = computeReputation(db, subject.did);
    expect(rep).not.toBeNull();
    expect(rep!.overall.score).toBeGreaterThan(0);
    expect(rep!.overall.totalInteractions).toBe(6);
  });

  it("handles negative scores", () => {
    const subject = makeAgent();
    registerAgent(subject);

    for (let i = 0; i < 3; i++) {
      const reporter = makeAgent();
      registerAgent(reporter);
      submitInteraction(reporter, subject.did, "information_quality", -0.5);
    }

    const rep = computeReputation(db, subject.did);
    expect(rep!.domains["information_quality"]!.score).toBeLessThan(0);
  });
});

describe("Agent Search", () => {
  it("searches by capability", () => {
    const agent = makeAgent();
    registerAgent(agent, {
      name: "SearchableAgent",
      skills: [{ id: "code-review", name: "Code Review" }],
    });

    const results = searchAgents(db, { capability: "code-review" });
    const found = results.find((a) => a.did === agent.did);
    expect(found).toBeDefined();
    expect(found!.name).toBe("SearchableAgent");
  });
});
