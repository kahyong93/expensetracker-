import 'server-only';
import type { JsonSchema } from './types';

/**
 * JSON Schemas for structured replies (OpenAI strict mode: every property required, no
 * extra properties). lib/ai/parse.ts checks the app-level rules on top of these.
 */

/** AI-1: `{ category }`. */
export const CATEGORY_SCHEMA: JsonSchema = {
  title: 'category_reply',
  type: 'object',
  properties: { category: { type: 'string', description: 'An existing category name, or a short new one' } },
  required: ['category'],
  additionalProperties: false,
};
