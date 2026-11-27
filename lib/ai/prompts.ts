import 'server-only';
import { categoriesOf } from '@/lib/calc';
import type { DisplayCurrency } from '@/lib/money';
import type { EntryType, InsightKind, MonthData } from '@/lib/types';
import type { AiMessage } from './types';

/**
 * Prompt builders (CLAUDE.md §7). Pure: the Server Action loads the user's month and
 * passes it in. Task wording is copied from the reference design word for word.
 */

/** Display amount with 2 decimals and no symbol, as in the reference `ctx()`. */
function displayAmount(cents: number, currency: DisplayCurrency): string {
  return ((cents / 100) * currency.rate).toFixed(2);
}

export function systemPrompt(currency: DisplayCurrency, json: boolean): string {
  return (
    'You are a cheerful, concise personal finance helper inside a budgeting app. Use only the data provided and never invent transactions. Write amounts like ' +
    currency.sym +
    '12.34.' +
    (json ? ' Reply with valid JSON only, no markdown or code fences.' : ' Reply in plain text without markdown, under 120 words.')
  );
}

/** The month as text: header, categories, budgets, then one line per entry. */
export function monthContext(month: MonthData, budgets: Record<string, number>, currency: DisplayCurrency): string {
  const budgetList = Object.entries(budgets);
  const budgetLine = budgetList.length
    ? '\nBudget set for this month: ' +
      budgetList.map(([category, cents]) => category + ' ' + displayAmount(cents, currency)).join(', ')
    : '';
  return (
    'Month: ' + month.key + '. Currency: ' + currency.code + ' (' + currency.sym + ').' +
    '\nExpense categories: ' + categoriesOf(month, 'Out').join(', ') +
    '. Income categories: ' + categoriesOf(month, 'In').join(', ') + '.' +
    budgetLine +
    '\nEntries (type | category | item | amount):\n' +
    month.entries
      .map((e) => e.type + ' | ' + e.category + ' | ' + e.label + (e.note ? ' (' + e.note + ')' : '') + ' | ' + displayAmount(e.amountCents, currency))
      .join('\n')
  );
}

/** AI-2 (reference `sendChat`): the month as an opening exchange, then the conversation. */
export function chatMessages(context: string, history: readonly AiMessage[]): AiMessage[] {
  return [
    { role: 'user', content: 'Here is my data:\n' + context },
    { role: 'assistant', content: 'Got it. What would you like to know?' },
    ...history,
  ];
}

/** Reference `runInsight` task lines. A kind is added here when its feature is built. */
const INSIGHT_TASKS: Partial<Record<InsightKind, string>> = {
  summary:
    'Write a friendly monthly summary with 3 points: the biggest spending driver, the savings result, and one notable pattern.',
};

const INSIGHT_SHAPE =
  'JSON shape: {"headline": one sentence, "points": [{"title": short, "text": one or two sentences}]}';

/** AI-3/5/7 (reference `runInsight`). Null for a kind that isn't built yet. */
export function insightPrompt(context: string, kind: InsightKind): string | null {
  const task = INSIGHT_TASKS[kind];
  return task ? context + '\n\nTask: ' + task + '\n' + INSIGHT_SHAPE : null;
}

/** AI-1 (reference `suggestCat`). */
export function categorisePrompt(input: {
  type: EntryType;
  label: string;
  note: string;
  categories: readonly string[];
}): string {
  return (
    'Categorise this ' + (input.type === 'Out' ? 'expense' : 'income') + ' item: "' + input.label + '"' +
    (input.note ? ' (note: ' + input.note + ')' : '') +
    '. Existing categories: ' + input.categories.join(', ') +
    '. Pick the best existing one; only propose a short new name if none fit. JSON: {"category": string}'
  );
}
