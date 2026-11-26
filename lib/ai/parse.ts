import 'server-only';
import { parseCategoryName } from '@/lib/validation';

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
