import { inputToCents, type DisplayCurrency } from "@/lib/money";
import { LIMITS } from "@/lib/validation";

/**
 * Budget planner input buffering (CLAUDE.md §8): inputs keep the raw string while the
 * user types and only commit to the store on blur or Enter. Totals still update live by
 * overlaying the parsed drafts on the stored budgets.
 */

/** Raw input strings by category name, only for inputs being edited. */
export type BudgetDrafts = Record<string, string>;

export type ParsedAmountInput =
  | { kind: "clear" }
  | { kind: "cents"; cents: number }
  | { kind: "invalid"; message: string };

/** Same wording as the Add item amount field (lib/validation `validateEntry`). */
const NEGATIVE_MESSAGE = "Enter an amount of 0 or more";
const TOO_LARGE_MESSAGE = "That amount looks too large";

/** "" clears (PRD P9), a valid number becomes SGD cents, anything else is invalid. */
export function parseAmountInput(raw: string, currency: DisplayCurrency): ParsedAmountInput {
  if (raw.trim() === "") return { kind: "clear" };
  const cents = inputToCents(raw, currency);
  if (cents == null) return { kind: "invalid", message: NEGATIVE_MESSAGE };
  if (cents > LIMITS.maxAmountCents) return { kind: "invalid", message: TOO_LARGE_MESSAGE };
  return { kind: "cents", cents };
}

/** Stored budgets with the valid drafts applied. Invalid drafts keep the stored value. */
export function applyBudgetDrafts(
  stored: Record<string, number>,
  drafts: BudgetDrafts,
  currency: DisplayCurrency,
): Record<string, number> {
  const names = Object.keys(drafts);
  if (names.length === 0) return stored;
  const live = { ...stored };
  for (const name of names) {
    const parsed = parseAmountInput(drafts[name], currency);
    if (parsed.kind === "clear") delete live[name];
    else if (parsed.kind === "cents") live[name] = parsed.cents;
  }
  return live;
}

/** Copy of a drafts record without one key. */
export function withoutDraft(drafts: BudgetDrafts, name: string): BudgetDrafts {
  if (!(name in drafts)) return drafts;
  const next = { ...drafts };
  delete next[name];
  return next;
}
