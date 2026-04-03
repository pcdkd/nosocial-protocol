import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentIdentity, canonicalize } from "../src/identity.js";

describe("AgentIdentity", () => {
  it("generates identity with correct format", () => {
    const identity = AgentIdentity.generate();
    expect(identity.publicKeyStr).toMatch(/^ed25519:/);
    expect(identity.did).toMatch(/^did:nosocial:[a-f0-9]{64}$/);
  });

  it("persists and reloads identity", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nosocial-test-"));
    try {
      const id1 = await AgentIdentity.loadOrCreate("test-agent", dir);
      const id2 = await AgentIdentity.loadOrCreate("test-agent", dir);
      expect(id1.did).toBe(id2.did);
      expect(id1.publicKeyStr).toBe(id2.publicKeyStr);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("different names produce different identities", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nosocial-test-"));
    try {
      const id1 = await AgentIdentity.loadOrCreate("agent-a", dir);
      const id2 = await AgentIdentity.loadOrCreate("agent-b", dir);
      expect(id1.did).not.toBe(id2.did);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("handles unsafe characters in names", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nosocial-test-"));
    try {
      const id = await AgentIdentity.loadOrCreate("graph:node/sub", dir);
      expect(id.did).toMatch(/^did:nosocial:/);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("signs objects with correct format", () => {
    const identity = AgentIdentity.generate();
    const sig = identity.sign({ hello: "world" });
    expect(sig).toMatch(/^ed25519:/);
    expect(sig.length).toBeGreaterThan(20);
  });
});

describe("canonicalize", () => {
  it("sorts keys", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("handles nested objects", () => {
    expect(canonicalize({ z: { b: 1, a: 2 }, a: 3 })).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it("handles arrays", () => {
    expect(canonicalize({ items: [3, 1, 2] })).toBe('{"items":[3,1,2]}');
  });
});
