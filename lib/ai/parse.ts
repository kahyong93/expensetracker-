import 'server-only';
import type { Insight, InsightKind } from '@/lib/types';
import { parseCategoryName, parseInsight } from '@/lib/validation';

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
const INSIGHT_POINTS: Partial<Record<InsightKind, { min: number; max: number }>> = {
  summary: { min: 3, max: 3 },
  alerts: { min: 2, max: 4 },
};

/** AI-3/5/7: the stored insight shape, with the kind's point count. */
export function parseInsightReply(value: unknown, kind: InsightKind): Insight | null {
  const rule = INSIGHT_POINTS[kind];
  if (!rule || !isRecord(value) || !Array.isArray(value.points)) return null;
  const insight = parseInsight({ headline: value.headline, points: value.points.slice(0, rule.max) });
  return insight && insight.points.length >= rule.min ? insight : null;
}
