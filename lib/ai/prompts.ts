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

/** Reference `runInsight` task lines. */
const INSIGHT_TASKS: Record<InsightKind, string> = {
  summary:
    'Write a friendly monthly summary with 3 points: the biggest spending driver, the savings result, and one notable pattern.',
  alerts:
    'Find 2-4 unusual or noteworthy spending items: one-off large payments, repeated small spends that add up, or categories over budget.',
  tips: 'Give 3 practical savings tips tied to specific merchants or categories in the data, each with an estimated monthly saving.',
};

const INSIGHT_SHAPE =
  'JSON shape: {"headline": one sentence, "points": [{"title": short, "text": one or two sentences}]}';

/** AI-3/5/7 (reference `runInsight`). */
export function insightPrompt(context: string, kind: InsightKind): string {
  return context + '\n\nTask: ' + INSIGHT_TASKS[kind] + '\n' + INSIGHT_SHAPE;
}

/** AI-4 (reference `suggestBudget`). Expected income is SGD cents, shown in the display currency. */
export function budgetPrompt(input: {
  context: string;
  nextKey: string;
  currency: DisplayCurrency;
  expectedCents: number;
  categories: readonly string[];
}): string {
  return (
    input.context +
    '\n\nTask: Suggest a realistic budget for each expense category for ' + input.nextKey +
    ', based on this month. Treat one-off or annual items (like large insurance payments) as non-recurring unless they clearly repeat. Expected income: ' +
    input.currency.sym + displayAmount(input.expectedCents, input.currency) +
    '. Use these category names exactly: ' + input.categories.join(', ') +
    '.\nJSON: {"budgets": {"<category>": number}, "note": one or two sentences explaining the plan}'
  );
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
