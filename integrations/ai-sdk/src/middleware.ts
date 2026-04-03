/**
 * NoSocial middleware for the Vercel AI SDK.
 *
 * Wraps a language model to auto-report interactions to the NoSocial oracle.
 * Reports are fire-and-forget and do not block model responses.
 */

import type { LanguageModelV1Middleware } from "ai";
import { Reporter } from "./reporter.js";
import type { NoSocialOptions } from "./types.js";

export function nosocialMiddleware(options: NoSocialOptions = {}): LanguageModelV1Middleware {
  const reporter = new Reporter(options);

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const modelId = model.modelId || "unknown-model";

      let result: Awaited<ReturnType<typeof doGenerate>>;
      try {
        result = await doGenerate();
      } catch (error) {
        // Report reliability failure
        reporter.reportEvent(modelId, "reliability", -0.5, {
          taskType: "ai-sdk-generate",
          error: error instanceof Error ? error.name : "UnknownError",
        });
        throw error;
      }

      // Report task completion
      reporter.reportEvent(modelId, "task_completion", 0.8, {
        taskType: "ai-sdk-generate",
        hasContent: result.text != null && result.text.length > 0,
      });

      // Report collaboration for tool calls
      const toolCalls = result.toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        for (const tool of toolCalls) {
          reporter.reportEvent(modelId, "collaboration", 0.7, {
            taskType: "ai-sdk-tool-call",
            toolName: tool.toolName,
          });
        }
      }

      return result;
    },

    wrapStream: async ({ doStream, params, model }) => {
      const modelId = model.modelId || "unknown-model";

      let streamResult: Awaited<ReturnType<typeof doStream>>;
      try {
        streamResult = await doStream();
      } catch (error) {
        reporter.reportEvent(modelId, "reliability", -0.5, {
          taskType: "ai-sdk-stream",
          error: error instanceof Error ? error.name : "UnknownError",
        });
        throw error;
      }

      const { stream, ...rest } = streamResult;

      // Wrap the stream to report after it completes
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush() {
          reporter.reportEvent(modelId, "task_completion", 0.8, {
            taskType: "ai-sdk-stream",
          });
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
}
