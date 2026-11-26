'use server';

import { complete, completeJson } from '@/lib/ai/client';
import { parseCategoryReply, type CategorySuggestion } from '@/lib/ai/parse';
import { categorisePrompt, chatMessages, monthContext, systemPrompt } from '@/lib/ai/prompts';
import { CATEGORY_SCHEMA } from '@/lib/ai/schemas';
import { categoriesOf } from '@/lib/calc';
import type { ActionResult, ChatTurn, EntryType } from '@/lib/types';
import { LIMITS, parseChatMessages, parseEntryType, parseMonthLabel } from '@/lib/validation';
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
