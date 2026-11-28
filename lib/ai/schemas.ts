import 'server-only';
import { PLAN_LINES } from '@/lib/plan';
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

/** AI-1 for expenses: `{ lineId }`, one of the fixed plan line ids. */
export const CATEGORY_LINE_SCHEMA: JsonSchema = {
  title: 'category_line_reply',
  type: 'object',
  properties: { lineId: { type: 'string', enum: PLAN_LINES.map((l) => l.id), description: 'The id of the best plan line' } },
  required: ['lineId'],
  additionalProperties: false,
};

/** AI-3/5/7: `{ headline, points: [{ title, text }] }`. */
export const INSIGHT_SCHEMA: JsonSchema = {
  title: 'insight_reply',
  type: 'object',
  properties: {
    headline: { type: 'string' },
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, text: { type: 'string' } },
        required: ['title', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'points'],
  additionalProperties: false,
};

/** AI-4: `{ budgets: { <each plan line id>: number }, note }`. */
export function budgetSchema(): JsonSchema {
  const ids = PLAN_LINES.map((l) => l.id);
  return {
    title: 'budget_reply',
    type: 'object',
    properties: {
      budgets: {
        type: 'object',
        properties: Object.fromEntries(ids.map((id) => [id, { type: 'number' }])),
        required: ids,
        additionalProperties: false,
      },
      note: { type: 'string' },
    },
    required: ['budgets', 'note'],
    additionalProperties: false,
  };
}

/** AI-6: `{ entries: [{ type, category, lineId, label, amount, note }] }`. `lineId` is '' for income. */
export const PASTE_SCHEMA: JsonSchema = {
  title: 'paste_reply',
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['Out', 'In'] },
          category: { type: 'string' },
          lineId: { type: 'string', enum: ['', ...PLAN_LINES.map((l) => l.id)] },
          label: { type: 'string' },
          amount: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['type', 'category', 'lineId', 'label', 'amount', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['entries'],
  additionalProperties: false,
};
