/*
 * Carry-over of unused budget (PRD §7.10 S5), ported from the reference design's unusedOf /
 * carrySrc. A month's unused budget for a line is its budget minus what was spent on that
 * line. Overspending counts against it. Pure: the server gathers the history.
 */
import { monthSortIndex, isMonthKey } from "@/lib/months";
import { getLine, SPEND_SECS, type CarryMode } from "@/lib/plan";

/** One earlier month that has a plan: its budgets and its spend, both by plan line id. */
export type MonthSnapshot = {
  key: string;
  budgets: Record<string, number>;
  actuals: Record<string, number>;
};

export type CarryInfo = {
  /** Unused (positive) or overspent (negative) cents per plan line id, summed over the source months. */
  byLine: Record<string, number>;
  /** Month keys the carry comes from, oldest first. */
  sources: string[];
};

export const NO_CARRY: CarryInfo = { byLine: {}, sources: [] };

/** Months since year 0: monotonic across Dec to Jan. Null for custom labels. */
function ordinal(key: string): number | null {
  if (!isMonthKey(key)) return null;
  const idx = monthSortIndex(key);
  return Math.floor(idx / 100) * 12 + (idx % 100) - 1;
}

/**
 * What carries into `targetKey`:
 * - off: nothing.
 * - last: only the month right before it.
 * - cum: every earlier month of the same calendar year (resets each January).
 * Only months with a non-empty plan count, and only lines of carrying sections.
 */
export function carryInto(targetKey: string, mode: CarryMode, history: readonly MonthSnapshot[]): CarryInfo {
  const target = ordinal(targetKey);
  if (mode === "off" || target == null) return NO_CARRY;

  const sources = history
    .map((m) => ({ m, ord: ordinal(m.key) }))
    .filter((x): x is { m: MonthSnapshot; ord: number } => x.ord != null && x.ord < target)
    .filter((x) => Object.keys(x.m.budgets).length > 0)
    .filter((x) => (mode === "last" ? x.ord === target - 1 : Math.floor(x.ord / 12) === Math.floor(target / 12)))
    .sort((a, b) => a.ord - b.ord);

  const byLine: Record<string, number> = {};
  for (const { m } of sources) {
    for (const [lineId, budget] of Object.entries(m.budgets)) {
      const line = getLine(lineId);
      if (!line || !SPEND_SECS.includes(line.sectionId)) continue;
      byLine[lineId] = (byLine[lineId] ?? 0) + (budget - (m.actuals[lineId] ?? 0));
    }
  }
  return { byLine, sources: sources.map((x) => x.m.key) };
}
