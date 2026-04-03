# @nosocial/ai-sdk

NoSocial reputation reporting for the [Vercel AI SDK](https://sdk.vercel.ai). Wrap any language model with one middleware — interactions are reported automatically.

## Install

```bash
npm install @nosocial/ai-sdk
```

## Usage

```typescript
import { nosocialMiddleware } from "@nosocial/ai-sdk";
import { wrapLanguageModel, generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Wrap your model with NoSocial middleware
const model = wrapLanguageModel({
  model: openai("gpt-4o"),
  middleware: nosocialMiddleware({
    oracleUrl: "https://api.nosocial.me",
    agentName: "my-assistant",
  }),
});

// Use the model as normal — reports are sent automatically
const result = await generateText({ model, prompt: "Explain quantum computing" });

// Streaming works too
const stream = await streamText({ model, prompt: "Write a haiku" });
```

## What it does

Every model call is automatically reported to the NoSocial oracle:

| Event | Domain | Score |
|---|---|---|
| Successful generation | `task_completion` | 0.8 |
| Generation with tool calls | `collaboration` | 0.7 per tool |
| Generation error | `reliability` | -0.5 |
| Stream completion | `task_completion` | 0.8 |

Reports are **fire-and-forget** — they never block model responses.

## Identity mapping

- **Reporter:** Your application, identified by `agentName`
- **Subject:** The model being called (e.g., `openai:gpt-4o`, `anthropic:claude-sonnet-4-5-20250514`)

Each identity gets a persistent Ed25519 keypair stored in `.nosocial/keys/`. The same model always gets the same DID across runs.

## Configuration

```typescript
nosocialMiddleware({
  oracleUrl: "https://api.nosocial.me",  // Oracle endpoint
  agentName: "my-assistant",              // Your application's identity
  keysDir: ".nosocial/keys",              // Where to store keypairs
  autoRegister: true,                     // Auto-register with oracle
  onError: (err) => console.error(err),   // Error callback (fire-and-forget)
})
```

## Works with any provider

The middleware wraps the AI SDK's `LanguageModelV1` interface, so it works with any provider:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

// Anthropic
const claude = wrapLanguageModel({
  model: anthropic("claude-sonnet-4-5-20250514"),
  middleware: nosocialMiddleware({ agentName: "my-app" }),
});

// Google
const gemini = wrapLanguageModel({
  model: google("gemini-2.0-flash"),
  middleware: nosocialMiddleware({ agentName: "my-app" }),
});
```

## Key storage

Agent keypairs are stored as raw key files in `.nosocial/keys/` with `0600` permissions. Add this to your `.gitignore`:

```
.nosocial/
```

## License

MIT
