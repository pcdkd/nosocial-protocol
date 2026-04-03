import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Reporter } from "../src/reporter.js";

const ORACLE_URL = "http://test-oracle:3000";

function mockFetch() {
  const calls: { url: string; body: unknown }[] = [];

  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url: urlStr, body });

    if (urlStr.includes("/v1/agents/challenge")) {
      return new Response(
        JSON.stringify({
          challengeId: "test-challenge",
          challenge: "test-challenge-string",
          did: "did:nosocial:abc",
          expiresAt: "2099-01-01T00:00:00Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlStr.includes("/v1/agents/register")) {
      return new Response(
        JSON.stringify({ did: "did:nosocial:abc", name: "test" }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlStr.includes("/v1/reports")) {
      return new Response(
        JSON.stringify({ accepted: true }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  });

  return { fetchMock, calls };
}

describe("Reporter", () => {
  let dir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nosocial-test-"));
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(dir, { recursive: true });
  });

  it("registers and submits report", async () => {
    const { fetchMock, calls } = mockFetch();
    globalThis.fetch = fetchMock;

    const reporter = new Reporter({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test-agent",
    });

    // reportEvent is fire-and-forget, so we need to call the internal method
    await (reporter as any)._doReport("gpt-4o", "task_completion", 0.8, {
      taskType: "test",
    });

    const reportCalls = calls.filter((c) => c.url.includes("/v1/reports"));
    expect(reportCalls).toHaveLength(1);
    expect((reportCalls[0].body as any).domain).toBe("task_completion");
    expect((reportCalls[0].body as any).score).toBe(0.8);
  });

  it("handles 409 already registered", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/v1/agents/challenge")) {
        return new Response(
          JSON.stringify({ error: "Already registered" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/v1/reports")) {
        return new Response(
          JSON.stringify({ accepted: true }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    const reporter = new Reporter({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test-agent",
    });

    await (reporter as any)._doReport("gpt-4o", "task_completion", 0.8);

    const reportCalls = fetchMock.mock.calls.filter(
      (c: any) => c[0].toString().includes("/v1/reports")
    );
    expect(reportCalls).toHaveLength(1);
  });

  it("clamps score to [-1, 1]", async () => {
    const { fetchMock, calls } = mockFetch();
    globalThis.fetch = fetchMock;

    const reporter = new Reporter({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test-agent",
    });

    await (reporter as any)._doReport("model", "reliability", -5.0);

    const reportCalls = calls.filter((c) => c.url.includes("/v1/reports"));
    expect((reportCalls[0].body as any).score).toBe(-1);
  });

  it("fire-and-forget calls onError on failure", async () => {
    // Registration succeeds but report submission fails
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/v1/agents/challenge")) {
        return new Response(
          JSON.stringify({ error: "Already registered" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/v1/reports")) {
        return new Response("Server error", { status: 500 });
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = fetchMock;

    const errors: unknown[] = [];
    const reporter = new Reporter({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test-agent",
      onError: (e) => errors.push(e),
    });

    reporter.reportEvent("model", "task_completion", 0.8);

    // Wait for fire-and-forget to settle (init does async file I/O)
    await new Promise((r) => setTimeout(r, 500));
    expect(errors).toHaveLength(1);
  });
});
