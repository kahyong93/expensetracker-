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

const FAKE_SUMMARY = {
  headline: 'A steady month with money left over.',
  points: [
    { title: 'Biggest driver', text: 'Food was your largest expense category.' },
    { title: 'Savings result', text: 'You kept most of what you earned.' },
    { title: 'Notable pattern', text: 'Small coffee purchases came up more than once.' },
  ],
};

const FAKE_ALERTS = {
  headline: 'Two things are worth a look this month.',
  points: [
    { title: 'Small spends add up', text: 'Coffee showed up several times this month.' },
    { title: 'One-off spike', text: 'One expense was much larger than the rest.' },
  ],
};

const FAKE_TIPS = {
  headline: 'Three easy wins for next month.',
  points: [
    { title: 'Brew coffee at home', text: 'Could save about S$20 a month.' },
    { title: 'Walk short trips', text: 'Could save about S$10 a month.' },
    { title: 'Pack lunch twice a week', text: 'Could save about S$30 a month.' },
  ],
};

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
    case 'summary':
      return FAKE_SUMMARY;
    case 'alerts':
      return FAKE_ALERTS;
    case 'tips':
      return FAKE_TIPS;
    default:
      return null;
  }
}
