import 'server-only';
import { ChatOpenAI } from '@langchain/openai';
import { fakeComplete, fakeCompleteJson } from './fake';
import type { AiRequest, JsonSchema } from './types';

/**
 * The only file that imports LangChain (CLAUDE.md §7, ADR 0001). One chat model call per
 * request: no agents, tools, memory or tracing. With AI_FAKE=1 it returns canned replies
 * and never calls OpenAI.
 */

const DEFAULT_MODEL = 'gpt-5.4-mini';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;
/**
 * Reasoning models spend hidden tokens from the same budget as the answer. Without this,
 * a 100-token cap (categorise) can run out before any answer is written.
 */
const REASONING_ALLOWANCE = 2_000;

/** The provider failed (network, auth, quota, timeout). Shown as "AI is busy…". */
export class AiProviderError extends Error {
  constructor(cause: unknown) {
    super('AI provider request failed', { cause });
    this.name = 'AiProviderError';
  }
}

function isFake(): boolean {
  return process.env.AI_FAKE === '1';
}

function chatModel(maxTokens: number): ChatOpenAI {
  return new ChatOpenAI({
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    maxTokens: maxTokens + REASONING_ALLOWANCE,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

function toMessages({ system, messages }: AiRequest) {
  return [{ role: 'system' as const, content: system }, ...messages];
}

/** LangChain throws this when a reply doesn't match the schema: a bad reply, not an outage. */
function isOutputParserError(error: unknown): boolean {
  return error instanceof Error && error.name === 'OutputParserException';
}

/** Plain-text reply (chat). */
export async function complete(request: AiRequest): Promise<string> {
  if (isFake()) return fakeComplete(request);
  try {
    const reply = await chatModel(request.maxTokens).invoke(toMessages(request));
    return reply.text.trim();
  } catch (error) {
    throw new AiProviderError(error);
  }
}

/**
 * Structured reply: OpenAI must fill in `schema` (strict JSON Schema mode). Returns the
 * parsed object, or null when the model's reply didn't fit. Callers still check the shape
 * with lib/ai/parse.ts.
 */
export async function completeJson(request: AiRequest & { schema: JsonSchema }): Promise<unknown> {
  if (isFake()) return fakeCompleteJson(request);
  try {
    const structured = chatModel(request.maxTokens).withStructuredOutput(request.schema, {
      name: request.schema.title,
      method: 'jsonSchema',
      strict: true,
    });
    return await structured.invoke(toMessages(request));
  } catch (error) {
    if (isOutputParserError(error)) return null;
    throw new AiProviderError(error);
  }
}
