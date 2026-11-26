import 'server-only';
import type { AiRequest, JsonSchema } from './types';

/**
 * Canned replies for AI_FAKE=1 (Playwright, offline dev). Never calls a provider. Replies
 * are derived from the prompt only, so they are deterministic.
 */

const DELAY_MS = 300;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lastUserMessage(request: AiRequest): string {
  return [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

const CATEGORY_HINTS: Array<{ words: string[]; category: string }> = [
  { words: ['kopi', 'rice', 'food', 'lunch', 'dinner', 'coffee', 'mcd', 'bread'], category: 'Food' },
  { words: ['grab', 'mrt', 'bus', 'taxi', 'gojek', 'transport', 'ez-link'], category: 'Transport' },
  { words: ['rent', 'rental', 'telco', 'telcom', 'singtel', 'bill', 'parent'], category: 'Fixed & Bills' },
  { words: ['uniqlo', 'shopee', 'lazada', 'insurance', 'sheng', 'ntuc'], category: 'Shopping & Insurance' },
  { words: ['salary', 'work', 'bonus'], category: 'Work' },
  { words: ['reimburse', 'claim'], category: 'Reimburse' },
  { words: ['interest', 'dbs', 'ocbc', 'uob', 'cdp'], category: 'Interest' },
];

/** AI-1: reads the item name out of the categorise prompt. */
function fakeCategory(prompt: string): { category: string } {
  const label = (/item: "([^"]*)"/.exec(prompt)?.[1] ?? '').toLowerCase();
  const isExpense = prompt.startsWith('Categorise this expense');
  const hint = CATEGORY_HINTS.find((h) => h.words.some((w) => label.includes(w)));
  return { category: hint?.category ?? (isExpense ? 'Misc' : 'Other income') };
}

/** AI-2: echoes the question so tests can tell replies apart. */
export async function fakeComplete(request: AiRequest): Promise<string> {
  await wait(DELAY_MS);
  return `You asked: "${lastUserMessage(request)}". Here's what I can see for this month. Ask me about a merchant, a category or a plan!`;
}

export async function fakeCompleteJson(request: AiRequest & { schema: JsonSchema }): Promise<unknown> {
  await wait(DELAY_MS);
  const prompt = lastUserMessage(request);
  switch (request.task) {
    case 'categorise':
      return fakeCategory(prompt);
    default:
      return null;
  }
}
