import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nosocialMiddleware } from "../src/middleware.js";

const ORACLE_URL = "http://test-oracle:3000";

function mockFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
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
}

describe("nosocialMiddleware", () => {
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

  it("wrapGenerate reports task_completion on success", async () => {
    const fetchMock = mockFetch();
    globalThis.fetch = fetchMock;

    const middleware = nosocialMiddleware({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test",
    });

    const mockResult = {
      text: "Hello world",
      toolCalls: [],
      finishReason: "stop" as const,
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      rawResponse: { headers: {} },
      response: { id: "test", timestamp: new Date(), modelId: "test" },
      request: { body: "" },
    };

    const doGenerate = vi.fn(async () => mockResult);

    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: {} as any,
      model: { modelId: "gpt-4o" } as any,
    } as any);

    expect(result).toBe(mockResult);
    expect(doGenerate).toHaveBeenCalledOnce();

    // Wait for fire-and-forget reports
    await new Promise((r) => setTimeout(r, 200));

    const reportCalls = fetchMock.mock.calls.filter(
      (c: any) => c[0].toString().includes("/v1/reports")
    );
    expect(reportCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("wrapGenerate reports reliability on error", async () => {
    const fetchMock = mockFetch();
    globalThis.fetch = fetchMock;

    const middleware = nosocialMiddleware({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test",
    });

    const doGenerate = vi.fn(async () => {
      throw new Error("Model error");
    });

    await expect(
      middleware.wrapGenerate!({
        doGenerate,
        params: {} as any,
        model: { modelId: "gpt-4o" } as any,
      } as any)
    ).rejects.toThrow("Model error");

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 200));

    const reportCalls = fetchMock.mock.calls.filter(
      (c: any) => c[0].toString().includes("/v1/reports")
    );
    expect(reportCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("wrapGenerate reports collaboration for tool calls", async () => {
    const fetchMock = mockFetch();
    globalThis.fetch = fetchMock;

    const middleware = nosocialMiddleware({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test",
    });

    const mockResult = {
      text: "",
      toolCalls: [
        { toolCallType: "function" as const, toolCallId: "1", toolName: "search", args: "{}" },
        { toolCallType: "function" as const, toolCallId: "2", toolName: "calculator", args: "{}" },
      ],
      finishReason: "tool-calls" as const,
      usage: { promptTokens: 10, completionTokens: 5 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      rawResponse: { headers: {} },
      response: { id: "test", timestamp: new Date(), modelId: "test" },
      request: { body: "" },
    };

    await middleware.wrapGenerate!({
      doGenerate: vi.fn(async () => mockResult),
      params: {} as any,
      model: { modelId: "gpt-4o" } as any,
    } as any);

    // Wait for fire-and-forget (task_completion + 2 tool collaboration reports)
    await new Promise((r) => setTimeout(r, 200));

    const reportCalls = fetchMock.mock.calls.filter(
      (c: any) => c[0].toString().includes("/v1/reports")
    );
    // At least 3: 1 task_completion + 2 collaboration
    expect(reportCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("wrapStream reports after stream completes", async () => {
    const fetchMock = mockFetch();
    globalThis.fetch = fetchMock;

    const middleware = nosocialMiddleware({
      oracleUrl: ORACLE_URL,
      keysDir: dir,
      agentName: "test",
    });

    const chunks = [
      { type: "text-delta" as const, textDelta: "Hello" },
      { type: "text-delta" as const, textDelta: " world" },
      { type: "finish" as const, finishReason: "stop" as const, usage: { promptTokens: 10, completionTokens: 5 } },
    ];

    const readableStream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const doStream = vi.fn(async () => ({
      stream: readableStream,
      rawCall: { rawPrompt: null, rawSettings: {} },
      rawResponse: { headers: {} },
    }));

    const result = await middleware.wrapStream!({
      doStream,
      params: {} as any,
      model: { modelId: "gpt-4o" } as any,
    } as any);

    // Consume the stream
    const reader = result.stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Wait for fire-and-forget
    await new Promise((r) => setTimeout(r, 200));

    const reportCalls = fetchMock.mock.calls.filter(
      (c: any) => c[0].toString().includes("/v1/reports")
    );
    expect(reportCalls.length).toBeGreaterThanOrEqual(1);
  });
});
