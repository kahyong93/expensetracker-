'use server';

import * as insightsData from '@/data/insights';
import * as plansData from '@/data/plans';
import { complete, completeJson } from '@/lib/ai/client';
import {
  parseBudgetReply,
  parseCategoryReply,
  parseInsightReply,
  parsePasteReply,
  type BudgetSuggestion,
  type CategorySuggestion,
} from '@/lib/ai/parse';
import {
  budgetPrompt,
  categorisePrompt,
  chatMessages,
  insightPrompt,
  monthContext,
  pastePrompt,
  systemPrompt,
} from '@/lib/ai/prompts';
import { CATEGORY_SCHEMA, INSIGHT_SCHEMA, PASTE_SCHEMA, budgetSchema } from '@/lib/ai/schemas';
import { PASTE_EMPTY_MESSAGE, PASTE_MAX_CHARS, PASTE_NO_ENTRIES_MESSAGE, PASTE_TOO_LONG_MESSAGE } from '@/lib/ai-messages';
import { categoriesOf, monthTotals } from '@/lib/calc';
import { nextOf } from '@/lib/months';
import type { ActionResult, ChatTurn, EntryInput, EntryType, Insight, InsightKind } from '@/lib/types';
import { LIMITS, parseChatMessages, parseEntryType, parseInsightKind, parseMonthLabel } from '@/lib/validation';
import { INVALID } from './run-action';
import { AI_BAD_REPLY, MONTH_MISSING, loadAiMonth, runAi } from './run-ai';

/*
 * AI Server Actions (CLAUDE.md §7, ADR 0001). The client sends the month key and the
 * user's own input only; amounts and categories are read from Neon for the signed-in user.
 */

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > max ? null : trimmed;
}

/** AI-2 Ask your money: the month as context plus the last few chat turns. */
export async function askMoneyAction(monthKey: string, messages: ChatTurn[]): Promise<ActionResult<string>> {
  return runAi(async () => {
    const key = parseMonthLabel(monthKey);
    const history = parseChatMessages(messages);
    if (!key || !history) return INVALID;

    const loaded = await loadAiMonth(key);
    if (!loaded) return MONTH_MISSING;
    const { bundle, currency } = loaded;

    const reply = await complete({
      task: 'chat',
      system: systemPrompt(currency, false),
      messages: chatMessages(monthContext(bundle.month, bundle.budgets, currency), history),
      maxTokens: 600,
    });
    // Capped so the reply still passes validation when it comes back as chat history.
    return reply ? { ok: true, data: reply.slice(0, LIMITS.chatReply) } : AI_BAD_REPLY;
  });
}

/**
 * AI-3/5/7 insight cards: generates the card from the user's month and saves it for that
 * month, replacing any earlier one ("Refresh").
 */
export async function generateInsightAction(monthKey: string, kind: InsightKind): Promise<ActionResult<Insight>> {
  return runAi(
    async () => {
      const key = parseMonthLabel(monthKey);
      const k = parseInsightKind(kind);
      if (!key || !k) return INVALID;

      const loaded = await loadAiMonth(key);
      if (!loaded) return MONTH_MISSING;
      const { bundle, currency } = loaded;
      const reply = await completeJson({
        task: k,
        system: systemPrompt(currency, true),
        messages: [{ role: 'user', content: insightPrompt(monthContext(bundle.month, bundle.budgets, currency), k) }],
        maxTokens: 900,
        schema: INSIGHT_SCHEMA,
      });
      const insight = parseInsightReply(reply, k);
      if (!insight) return AI_BAD_REPLY;

      const saved = await insightsData.saveInsight(key, k, insight);
      return saved.ok ? { ok: true, data: insight } : saved;
    },
    { revalidate: true },
  );
}

/**
 * AI-4 Smart budget: suggests next month's budget for every expense category and saves it
 * with the AI note under next month's key (which may not exist yet, PRD P8).
 */
export async function suggestBudgetAction(monthKey: string): Promise<ActionResult<BudgetSuggestion>> {
  return runAi(
    async () => {
      const key = parseMonthLabel(monthKey);
      if (!key) return INVALID;

      const loaded = await loadAiMonth(key);
      if (!loaded) return MONTH_MISSING;
      const { bundle, currency } = loaded;
      const categories = categoriesOf(bundle.month, 'Out');
      if (categories.length === 0) return INVALID;
      const nextKey = nextOf(key);
      // P3: expected income defaults to this month's income.
      const expectedCents = bundle.nextPlan.expectedCents ?? monthTotals(bundle.month).earnedCents;

      const reply = await completeJson({
        task: 'budget',
        system: systemPrompt(currency, true),
        messages: [
          {
            role: 'user',
            content: budgetPrompt({
              context: monthContext(bundle.month, bundle.budgets, currency),
              nextKey,
              currency,
              expectedCents,
              categories,
            }),
          },
        ],
        maxTokens: 600,
        schema: budgetSchema(categories),
      });
      const suggestion = parseBudgetReply(reply, categories, currency);
      if (!suggestion) return AI_BAD_REPLY;

      await plansData.replaceBudgets(nextKey, suggestion.budgets, suggestion.note);
      return { ok: true, data: suggestion };
    },
    { revalidate: true },
  );
}

/**
 * AI-6 Paste to add: extracts preview rows from pasted text. Saves nothing; the user
 * confirms in the UI, which then calls addEntriesAction.
 */
export async function parsePasteAction(monthKey: string, text: string): Promise<ActionResult<EntryInput[]>> {
  return runAi(async () => {
    const key = parseMonthLabel(monthKey);
    if (!key || typeof text !== 'string') return INVALID;
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, code: 'paste_empty', message: PASTE_EMPTY_MESSAGE };
    if (trimmed.length > PASTE_MAX_CHARS) return { ok: false, code: 'paste_too_long', message: PASTE_TOO_LONG_MESSAGE };

    const loaded = await loadAiMonth(key);
    if (!loaded) return MONTH_MISSING;
    const { bundle, currency } = loaded;
    const categories = { Out: categoriesOf(bundle.month, 'Out'), In: categoriesOf(bundle.month, 'In') };

    const reply = await completeJson({
      task: 'paste',
      system: systemPrompt(currency, true),
      messages: [{ role: 'user', content: pastePrompt({ categories, currency, text: trimmed }) }],
      maxTokens: 1500,
      schema: PASTE_SCHEMA,
    });
    const rows = parsePasteReply(reply, categories, currency);
    if (!rows) return AI_BAD_REPLY;
    if (rows.length === 0) return { ok: false, code: 'paste_no_entries', message: PASTE_NO_ENTRIES_MESSAGE };
    return { ok: true, data: rows };
  });
}

/** AI-1 Auto-categorise. */
export async function suggestCategoryAction(
  monthKey: string,
  input: { type: EntryType; label: string; note: string },
): Promise<ActionResult<CategorySuggestion>> {
  return runAi(async () => {
    const key = parseMonthLabel(monthKey);
    const type = parseEntryType(input?.type);
    const label = boundedString(input?.label, LIMITS.label);
    const note = boundedString(input?.note ?? '', LIMITS.note);
    if (!key || !type || !label || note === null) return INVALID;

    const loaded = await loadAiMonth(key);
    if (!loaded) return MONTH_MISSING;
    const categories = categoriesOf(loaded.bundle.month, type);

    const reply = await completeJson({
      task: 'categorise',
      system: systemPrompt(loaded.currency, true),
      messages: [{ role: 'user', content: categorisePrompt({ type, label, note, categories }) }],
      maxTokens: 100,
      schema: CATEGORY_SCHEMA,
    });
    const suggestion = parseCategoryReply(reply, categories);
    return suggestion ? { ok: true, data: suggestion } : AI_BAD_REPLY;
  });
}
