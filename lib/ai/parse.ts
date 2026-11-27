import 'server-only';
import type { EntryInput, EntryType, Insight, InsightKind } from '@/lib/types';
import { displayToCents, type DisplayCurrency } from '@/lib/money';
import {
  LIMITS,
  MAX_ENTRIES_PER_REQUEST,
  parseAiNote,
  parseCategoryName,
  parseEntryType,
  parseInsight,
} from '@/lib/validation';

/**
 * App-level checks on structured AI replies (CLAUDE.md §7). The schema already fixes the
 * shape; these enforce what the app depends on. Each returns null on a bad reply, which
 * the UI shows as "Couldn't read the AI reply, try again".
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type CategorySuggestion = {
  /** An existing category's exact name, or a new name the AI proposed. */
  category: string;
  isNew: boolean;
};

/** AI-1: match the reply to an existing category case-insensitively, else a valid new name. */
export function parseCategoryReply(value: unknown, categories: readonly string[]): CategorySuggestion | null {
  if (!isRecord(value)) return null;
  const name = parseCategoryName(value.category);
  if (!name) return null;
  const hit = categories.find((c) => c.toLowerCase() === name.toLowerCase());
  return hit ? { category: hit, isNew: false } : { category: name, isNew: true };
}

/** How many points each insight card needs (PRD AI-3/5/7). Extra points are cut. */
const INSIGHT_POINTS: Record<InsightKind, { min: number; max: number }> = {
  summary: { min: 3, max: 3 },
  alerts: { min: 2, max: 4 },
  tips: { min: 3, max: 3 },
};

/** AI-3/5/7: the stored insight shape, with the kind's point count. */
export function parseInsightReply(value: unknown, kind: InsightKind): Insight | null {
  const rule = INSIGHT_POINTS[kind];
  if (!isRecord(value) || !Array.isArray(value.points)) return null;
  const insight = parseInsight({ headline: value.headline, points: value.points.slice(0, rule.max) });
  return insight && insight.points.length >= rule.min ? insight : null;
}

export type BudgetSuggestion = {
  /** Expense category → SGD cents. */
  budgets: Record<string, number>;
  note: string;
};

/**
 * AI-4: keeps exact category names only, converts each display-currency amount to SGD
 * cents, and drops negative or non-finite amounts. Null when nothing usable is left.
 */
export function parseBudgetReply(
  value: unknown,
  categories: readonly string[],
  currency: DisplayCurrency,
): BudgetSuggestion | null {
  if (!isRecord(value) || !isRecord(value.budgets) || typeof value.note !== 'string') return null;
  const note = parseAiNote(value.note);
  if (note == null) return null;
  const budgets: Record<string, number> = {};
  for (const category of categories) {
    const cents = displayToCents(value.budgets[category], currency);
    if (cents != null && cents <= LIMITS.maxAmountCents) budgets[category] = cents;
  }
  return Object.keys(budgets).length > 0 ? { budgets, note } : null;
}

function trimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/**
 * AI-6: preview rows from the paste reply. Each row needs a valid type, category and label
 * and an amount > 0 (display currency → SGD cents); an existing category of that type is
 * matched case-insensitively. Bad rows are dropped, an over-long note is cut, and at most
 * MAX_ENTRIES_PER_REQUEST rows are kept. Null when the reply has the wrong shape.
 */
export function parsePasteReply(
  value: unknown,
  categories: Record<EntryType, readonly string[]>,
  currency: DisplayCurrency,
): EntryInput[] | null {
  if (!isRecord(value) || !Array.isArray(value.entries)) return null;
  const rows: EntryInput[] = [];
  for (const item of value.entries) {
    if (rows.length >= MAX_ENTRIES_PER_REQUEST) break;
    if (!isRecord(item)) continue;
    const type = parseEntryType(item.type);
    const name = parseCategoryName(item.category);
    const label = trimmedString(item.label);
    const amountCents = displayToCents(item.amount, currency);
    if (!type || !name || !label || label.length > LIMITS.label) continue;
    if (amountCents == null || amountCents <= 0 || amountCents > LIMITS.maxAmountCents) continue;
    const category = categories[type].find((c) => c.toLowerCase() === name.toLowerCase()) ?? name;
    const note = (trimmedString(item.note) ?? '').slice(0, LIMITS.note);
    rows.push({ type, category, label, amountCents, note });
  }
  return rows;
}
