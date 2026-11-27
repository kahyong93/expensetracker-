# ADR 0001: AI features via LangChain and OpenAI, in Server Actions

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

The seven AI features (PRD §7.7, AI-1 to AI-7) had finished UI but called a browser-side stub (`lib/mock/ai.ts`) with canned replies. No AI SDK was installed. CLAUDE.md §7 said to use `app/api/ai/*` route handlers, but `docs/data-fetching.md` does not allow route handlers to fetch data, and every AI prompt needs the user's month.

## Decision

1. **Provider:** OpenAI, called through LangChain (`langchain`, `@langchain/core`, `@langchain/openai`). The model comes from `AI_MODEL` (default `gpt-5.4-mini`) and the key from `OPENAI_API_KEY`.
2. **Only the basic part of LangChain:** one chat model call per request. No agents, LangGraph, tools, memory or LangSmith tracing. Tracing would send financial data to another service, so the AI client forces the `LANGSMITH_*` / `LANGCHAIN_*` tracing variables to `false` at load time, even when `.env` turns them on.
3. **One wrapper:** `lib/ai/client.ts` is the only file that imports LangChain. Switching provider means changing that file and the env.
4. **Server Actions, not route handlers:** `server/actions/ai.ts`. Each action re-checks the session, applies the rate limit and loads the signed-in user's month from Neon through `/data` helpers. The client sends only the month key and the user's own input, never amounts or categories. `docs/data-fetching.md` records this as the one read exception.
5. **Structured replies:** `withStructuredOutput(jsonSchema, { method: "jsonSchema", strict: true })` with plain JSON Schemas (no zod). OpenAI then has to fill the form. `lib/ai/parse.ts` still checks what the app depends on: real category names, positive amounts and point counts. OpenAI needs an object at the root, so the paste prompt's shape line asks for `{"entries": [...]}` instead of a bare array. Every other reference prompt is used word for word.
6. **Rate limit:** about 15 requests per user per minute, kept in server memory. It resets on restart and is counted per instance. That's acceptable for a personal app; move it to Neon if the app gets real users on serverless hosting.
7. **Chat history:** the last 10 messages are sent with the month's data.
8. **Paste amounts** are read in the display currency and converted to SGD cents like typed amounts.
9. **Tests:** `AI_FAKE=1` makes the client return canned replies (`lib/ai/fake.ts`), so Playwright never calls OpenAI. Unit tests cover the pure helpers (prompts, parse, rate limit). The browser stub `lib/mock/ai.ts` is removed.
10. **Build order:** shared setup first, then one feature per commit: auto-categorise, chat, summary, alerts, tips, smart budget, paste to add.

## Consequences

- Three new dependencies.
- AI actions read data, which is a documented exception to "Server Actions are for mutations only".
- With an in-memory limit, a restart or a second instance resets or splits the count.
- Reasoning models spend hidden tokens. The client adds a fixed allowance on top of each feature's answer cap so short replies aren't cut off.
