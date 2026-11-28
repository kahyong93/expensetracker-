import 'server-only';
import { categoriesOf } from '@/lib/calc';
import { PLAN, PLAN_LINES, type Split } from '@/lib/plan';
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

/** The plan the AI sees next to the month: this month's budgets by plan line id, carry-over and split. */
export type PlanContext = {
  lineBudgets: Record<string, number>;
  carry: Record<string, number>;
  split: Split;
};

/** Signed display amount for carry-over, e.g. +30.00 or -5.00. */
function signedAmount(cents: number, currency: DisplayCurrency): string {
  return (cents >= 0 ? '+' : '-') + displayAmount(Math.abs(cents), currency);
}

/**
 * The month as text: header, the budget plan (sections, their lines and split targets),
 * this month's budgets with carry-over, then one line per entry.
 */
export function monthContext(month: MonthData, plan: PlanContext, currency: DisplayCurrency): string {
  const budgetParts = PLAN_LINES.filter((l) => plan.lineBudgets[l.id] != null || plan.carry[l.id] != null).map((l) => {
    const amount = plan.lineBudgets[l.id] != null ? ' ' + displayAmount(plan.lineBudgets[l.id], currency) : '';
    const carry = plan.carry[l.id] != null ? ' (carry-over ' + signedAmount(plan.carry[l.id], currency) + ')' : '';
    return l.name + amount + carry;
  });
  const budgetLine = budgetParts.length
    ? '\nBudget set for this month (carry-over is unused budget from earlier months, negative if overspent): ' +
      budgetParts.join('; ')
    : '';
  return (
    'Month: ' + month.key + '. Currency: ' + currency.code + ' (' + currency.sym + ').' +
    '\nBudget plan, target share of income: ' + PLAN.map((s) => s.title + ' ' + plan.split[s.id] + '%').join(', ') + '.' +
    '\nExpense categories by section:\n' +
    PLAN.map((s) => s.title + ': ' + s.lines.map((l) => l.name).join('; ')).join('\n') +
    '\nIncome categories: ' + categoriesOf(month, 'In').join(', ') + '.' +
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

/** The sections with their lines as "id = name [hint]", and each section's split target (reference `suggestBudget`). */
function planWithTargets(split: Split): string {
  return PLAN.map(
    (s) =>
      s.title + ' (target ' + split[s.id] + '% of income): ' +
      s.lines.map((l) => l.id + ' = ' + l.name + (l.hint ? ' [' + l.hint + ']' : '')).join('; '),
  ).join('\n');
}

/** AI-4 (reference `suggestBudget`). Expected income is SGD cents, shown in the display currency. */
export function budgetPrompt(input: {
  context: string;
  nextKey: string;
  currency: DisplayCurrency;
  expectedCents: number;
  split: Split;
}): string {
  return (
    input.context +
    '\n\nTask: Plan a realistic budget for ' + input.nextKey + ' in three sections. Expected income: ' +
    input.currency.sym + displayAmount(input.expectedCents, input.currency) +
    ". Base basic needs on this month's real spending; treat one-off or annual items (like large insurance payments) as non-recurring unless they clearly repeat. Put money into investment / savings lines, and keep entertainment sensible. " +
    (/Dec/.test(input.nextKey) ? 'It is December, so allow a little extra for gifts and celebrations. ' : '') +
    'Use 0 for lines that do not apply. Lines by id:\n' + planWithTargets(input.split) +
    '\nJSON: {"plan": {"<id>": number}, "note": one or two sentences explaining the plan}'
  );
}

/**
 * AI-6 (reference `runPaste`). Two changes from the reference: OpenAI structured output needs
 * an object at the root, so the shape line asks for `{"entries": [...]}`; and expenses pick a
 * fixed plan line (`lineId`) instead of a free-text category.
 */
export function pastePrompt(input: {
  incomeCategories: readonly string[];
  currency: DisplayCurrency;
  text: string;
}): string {
  return (
    'Extract every money entry from the text below. Expense lines (id = name) by section: ' + planLineList() +
    '. Income categories: ' + input.incomeCategories.join(', ') +
    '. For an expense set "lineId" to the best line id; for income use an existing category when it fits, otherwise a short new one, and set "lineId" to "". Amounts as plain numbers in ' + input.currency.code + '.' +
    '\nReturn a JSON object: {"entries": [{"type": "Out" or "In", "category": string, "lineId": string, "label": short merchant or source, "amount": number, "note": short string or ""}]}' +
    '\n\nText:\n' + input.text
  );
}


/** Every section with its lines as "id = name", for prompts that ask the AI to pick a plan line. */
function planLineList(): string {
  return PLAN.map((s) => s.title + ': ' + s.lines.map((l) => l.id + ' = ' + l.name).join('; ')).join('. ');
}

/**
 * AI-1 (reference `suggestCat`). Expenses pick one of the fixed plan lines by id; income
 * picks from the month's own categories.
 */
export function categorisePrompt(input: {
  type: EntryType;
  label: string;
  note: string;
  categories: readonly string[];
}): string {
  if (input.type === 'Out') {
    return (
      'Categorise this expense item: "' + input.label + '"' +
      (input.note ? ' (note: ' + input.note + ')' : '') +
      '. Pick the best category (id = name) from these sections: ' + planLineList() +
      '. JSON: {"lineId": string}'
    );
  }
  return (
    'Categorise this income item: "' + input.label + '"' +
    (input.note ? ' (note: ' + input.note + ')' : '') +
    '. Existing categories: ' + input.categories.join(', ') +
    '. Pick the best existing one; only propose a short new name if none fit. JSON: {"category": string}'
  );
}
