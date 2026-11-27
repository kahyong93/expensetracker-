import 'server-only';
import type { ChatTurn } from '@/lib/types';

/** Shared shapes for the AI helpers (CLAUDE.md §7). */

/** Which feature a request is for. The fake client uses it to pick a canned reply. */
export type AiTask = 'categorise' | 'chat' | 'summary' | 'alerts' | 'tips' | 'budget' | 'paste';

export type AiMessage = ChatTurn;

export type AiRequest = {
  task: AiTask;
  system: string;
  messages: AiMessage[];
  /** Budget for the visible answer (CLAUDE.md §7 table). */
  maxTokens: number;
};

/** A plain JSON Schema object for OpenAI strict structured output. */
export type JsonSchema = {
  /** Also the structured-output name: letters, digits, `_` and `-` only. */
  title: string;
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};
