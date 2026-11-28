/**
 * Pure derived-number functions (PRD §8). Never compute these inline in JSX.
 * Every amount in and out is integer SGD cents.
 */
import { categoryColor } from "@/lib/design/palette";
import { getSection, PLAN, PLAN_LINES, UNASSIGNED, type SectionId, type Split } from "@/lib/plan";
import type { Entry, EntryType, MonthData } from "@/lib/types";

export function sumCents(entries: readonly Entry[]): number {
  return entries.reduce((acc, e) => acc + e.amountCents, 0);
}

export function entriesOfType(month: MonthData, type: EntryType): Entry[] {
  return month.entries.filter((e) => e.type === type);
}

/** Categories of a type in saved order, plus any category only present on entries. */
export function categoriesOf(month: MonthData, type: EntryType): string[] {
  const set = new Set(type === "Out" ? month.outOrder : month.inOrder);
  for (const e of month.entries) if (e.type === type) set.add(e.category);
  return [...set];
}

/** Round to a fixed number of decimals and return as a number. */
function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** "12.3%" style label. */
export function formatPct(pct: number, decimals = 1): string {
  return `${pct.toFixed(decimals)}%`;
}

export type MonthTotals = {
  earnedCents: number;
  spentCents: number;
  leftCents: number;
  /** Left ÷ Earned × 100, 1 decimal, 0 if nothing earned. */
  savedPct: number;
  /** Spent ÷ Earned × 100 (uncapped). 0 if nothing earned. */
  spentRatioPct: number;
  /** Width for the saving bar: spent ÷ earned capped at 100. */
  savingBarPct: number;
  /** True when spending exceeds income (bar turns orange). */
  overspent: boolean;
  inCount: number;
  outCount: number;
  inCategoryCount: number;
  outCategoryCount: number;
};

export function monthTotals(month: MonthData): MonthTotals {
  const inE = entriesOfType(month, "In");
  const outE = entriesOfType(month, "Out");
  const earnedCents = sumCents(inE);
  const spentCents = sumCents(outE);
  const leftCents = earnedCents - spentCents;
  const spentRatioPct = earnedCents ? (spentCents / earnedCents) * 100 : 0;
  return {
    earnedCents,
    spentCents,
    leftCents,
    savedPct: earnedCents ? roundTo((leftCents / earnedCents) * 100, 1) : 0,
    spentRatioPct,
    savingBarPct: Math.min(spentRatioPct, 100),
    overspent: spentRatioPct > 100,
    inCount: inE.length,
    outCount: outE.length,
    inCategoryCount: categoriesOf(month, "In").length,
    outCategoryCount: categoriesOf(month, "Out").length,
  };
}

/** Balance-card mood (PRD D3). */
export function balanceMood(leftCents: number): { tag: string; mood: string } {
  return leftCents < 0
    ? { tag: "Left · a little over", mood: "(｡•́︿•̀｡)" }
    : { tag: "Left · saved", mood: "(ﾉ◕ヮ◕)ﾉ" };
}

export type BudgetStatus = {
  budgetCents: number;
  spentCents: number;
  /** min(spent ÷ budget, 100%) as 0–100. A zero budget with any spend is 100. */
  usePct: number;
  over: boolean;
  /** budget − spent when within budget, spent − budget when over. Always ≥ 0. */
  diffCents: number;
  /** Unused budget carried in from earlier months (negative when overspent); already inside budgetCents. */
  carryCents: number;
};

export function budgetStatus(spentCents: number, plannedCents: number, carryCents = 0): BudgetStatus {
  // What can be spent: this month's budget plus unused budget carried over (negative if overspent).
  const budgetCents = plannedCents + carryCents;
  const over = spentCents > budgetCents;
  const usePct = budgetCents > 0 ? Math.min((spentCents / budgetCents) * 100, 100) : 100;
  return {
    budgetCents,
    spentCents,
    usePct,
    over,
    diffCents: over ? spentCents - budgetCents : budgetCents - spentCents,
    carryCents,
  };
}

export type CategoryStat = {
  name: string;
  /** Index in the board order, used for the palette. */
  index: number;
  color: string;
  tint: string;
  count: number;
  totalCents: number;
  /** Share of the type total, 0–100 (unrounded; format with formatPct). */
  sharePct: number;
  /** Budget status for this category in this month, if one is set (expenses only). */
  budget: BudgetStatus | null;
};

/**
 * One row per category of a type, in board order. Pass the month's budgets to get
 * budget status (only meaningful for expenses).
 */
export function categoryBreakdown(
  month: MonthData,
  type: EntryType,
  budgets: Record<string, number> = {},
): CategoryStat[] {
  const entries = entriesOfType(month, type);
  const typeTotal = sumCents(entries);
  return categoriesOf(month, type).map((name, index) => {
    const items = entries.filter((e) => e.category === name);
    const totalCents = sumCents(items);
    const { solid, tint } = categoryColor(index);
    const budgetCents = type === "Out" ? budgets[name] : undefined;
    return {
      name,
      index,
      color: solid,
      tint,
      count: items.length,
      totalCents,
      sharePct: typeTotal ? (totalCents / typeTotal) * 100 : 0,
      budget: budgetCents == null ? null : budgetStatus(totalCents, budgetCents),
    };
  });
}

/** Share decimals per PRD §8: 1 for expenses, 2 for income. */
export function shareDecimals(type: EntryType): number {
  return type === "Out" ? 1 : 2;
}

export type DonutStop = { color: string; fromPct: number; toPct: number };

/** Cumulative stops for the expense donut. */
export function donutStops(stats: readonly CategoryStat[]): DonutStop[] {
  let acc = 0;
  return stats.map((s) => {
    const from = acc;
    acc += s.sharePct;
    return { color: s.color, fromPct: from, toPct: acc };
  });
}

/** CSS conic-gradient for the donut, or null when nothing was spent. */
export function donutGradient(stats: readonly CategoryStat[]): string | null {
  const stops = donutStops(stats).filter((s) => s.toPct > s.fromPct);
  if (stops.length === 0) return null;
  return `conic-gradient(${stops.map((s) => `${s.color} ${s.fromPct}% ${s.toPct}%`).join(", ")})`;
}

export type MerchantRow = {
  label: string;
  totalCents: number;
  count: number;
  /** Category of the first entry seen for this merchant. */
  category: string;
  /** Bar width relative to #1, 0–100. */
  barPct: number;
};

/** Expenses grouped by trimmed item name, largest first (PRD D6). */
export function merchantRanking(month: MonthData, limit: number): MerchantRow[] {
  const map = new Map<string, { label: string; totalCents: number; count: number; category: string }>();
  for (const e of entriesOfType(month, "Out")) {
    const key = e.label.trim();
    const row = map.get(key) ?? { label: key, totalCents: 0, count: 0, category: e.category };
    row.totalCents += e.amountCents;
    row.count += 1;
    map.set(key, row);
  }
  const sorted = [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
  const top = sorted[0]?.totalCents ?? 0;
  return sorted.slice(0, limit).map((r) => ({ ...r, barPct: top ? (r.totalCents / top) * 100 : 0 }));
}

export type BigExpenseRow = { entry: Entry; barPct: number };

/** Largest single expenses (PRD D6 "Biggest 10"). */
export function biggestExpenses(month: MonthData, limit: number): BigExpenseRow[] {
  const sorted = [...entriesOfType(month, "Out")].sort((a, b) => b.amountCents - a.amountCents);
  const top = sorted[0]?.amountCents ?? 0;
  return sorted.slice(0, limit).map((entry) => ({ entry, barPct: top ? (entry.amountCents / top) * 100 : 0 }));
}

/** Case-insensitive search over label and note (PRD B2). */
export function filterEntries(entries: readonly Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter((e) => e.label.toLowerCase().includes(q) || e.note.toLowerCase().includes(q));
}

export type PlanDiff =
  | { kind: "none" }
  | { kind: "same" }
  | { kind: "less"; cents: number }
  | { kind: "more"; cents: number };

export type PlanRow = {
  name: string;
  color: string;
  actualCents: number;
  budgetCents: number | null;
  /** Comparison bars share one scale (max of all actuals and budgets). */
  actualBarPct: number;
  budgetBarPct: number;
  diff: PlanDiff;
};

/** Budget planner rows for next month, one per expense category of this month (PRD P2). */
export function planRows(month: MonthData, nextBudgets: Record<string, number>): PlanRow[] {
  const stats = categoryBreakdown(month, "Out");
  const scale = Math.max(1, ...stats.map((s) => s.totalCents), ...stats.map((s) => nextBudgets[s.name] ?? 0));
  return stats.map((s) => {
    const budgetCents = nextBudgets[s.name] ?? null;
    let diff: PlanDiff = { kind: "none" };
    if (budgetCents != null) {
      if (budgetCents === s.totalCents) diff = { kind: "same" };
      else if (budgetCents < s.totalCents) diff = { kind: "less", cents: s.totalCents - budgetCents };
      else diff = { kind: "more", cents: budgetCents - s.totalCents };
    }
    return {
      name: s.name,
      color: s.color,
      actualCents: s.totalCents,
      budgetCents,
      actualBarPct: (s.totalCents / scale) * 100,
      budgetBarPct: ((budgetCents ?? 0) / scale) * 100,
      diff,
    };
  });
}

/** Total budget (sum of rows for current categories) and left to save (PRD P4). */
export function planTotals(
  categories: readonly string[],
  nextBudgets: Record<string, number>,
  expectedCents: number,
): { totalCents: number; leftToSaveCents: number } {
  const totalCents = categories.reduce((acc, c) => acc + (nextBudgets[c] ?? 0), 0);
  return { totalCents, leftToSaveCents: expectedCents - totalCents };
}

/** Actuals per expense category, used by "Fill with {month} amounts" (PRD P5). */
export function actualsByCategory(month: MonthData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of categoryBreakdown(month, "Out")) out[s.name] = s.totalCents;
  return out;
}

/** Live sample audit figures (PRD D7). */
export function categoryTotal(month: MonthData, type: EntryType, category: string): number {
  return sumCents(month.entries.filter((e) => e.type === type && e.category === category));
}

/** Count of entries in one category (for delete-empty-only, PRD B11). */
export function categoryCount(month: MonthData, type: EntryType, category: string): number {
  return month.entries.filter((e) => e.type === type && e.category === category).length;
}

// ---------------------------------------------------------------------------
// Budget plan by section and line (PRD §7.10). Entries match budgets by saved line id.

/** Spent per plan line id, from expenses that have a saved line. */
export function actualsByLine(month: MonthData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of month.entries) {
    if (e.type === "Out" && e.lineId) out[e.lineId] = (out[e.lineId] ?? 0) + e.amountCents;
  }
  return out;
}

/** Expenses with no plan line yet (Unassigned): excluded from every line's spend. */
export function unassignedCents(month: MonthData): number {
  return month.entries.reduce((acc, e) => (e.type === "Out" && !e.lineId ? acc + e.amountCents : acc), 0);
}

export type PlanLineRow = PlanRow & {
  id: string;
  hint: string;
  sectionId: SectionId;
  /** Unused budget carried in from earlier months, or null when this line has none. */
  carryCents: number | null;
};

/** One planner row per plan line, in budget-page order. */
export function planLineRows(
  month: MonthData,
  lineBudgets: Record<string, number>,
  carry: Record<string, number> = {},
): PlanLineRow[] {
  const actuals = actualsByLine(month);
  const scale = Math.max(1, ...PLAN_LINES.map((l) => actuals[l.id] ?? 0), ...PLAN_LINES.map((l) => lineBudgets[l.id] ?? 0));
  return PLAN_LINES.map((line) => {
    const actualCents = actuals[line.id] ?? 0;
    const budgetCents = lineBudgets[line.id] ?? null;
    let diff: PlanDiff = { kind: "none" };
    if (budgetCents != null) {
      if (budgetCents === actualCents) diff = { kind: "same" };
      else if (budgetCents < actualCents) diff = { kind: "less", cents: actualCents - budgetCents };
      else diff = { kind: "more", cents: budgetCents - actualCents };
    }
    return {
      id: line.id,
      hint: line.hint,
      sectionId: line.sectionId,
      carryCents: carry[line.id] ?? null,
      name: line.name,
      color: getSection(line.sectionId)?.color ?? "",
      actualCents,
      budgetCents,
      actualBarPct: (actualCents / scale) * 100,
      budgetBarPct: ((budgetCents ?? 0) / scale) * 100,
      diff,
    };
  });
}

/** How a section's budget compares with its split target (reference planSections). */
export type SectionStatus =
  | { kind: "none" }
  | { kind: "on" }
  /** Investment / Savings only: planned less than the target. */
  | { kind: "short"; cents: number }
  /** Investment / Savings only: planned more than the target. */
  | { kind: "above"; cents: number }
  | { kind: "over"; cents: number }
  | { kind: "under"; cents: number };

export type SectionPlan = {
  id: SectionId;
  totalCents: number;
  targetCents: number;
  splitPct: number;
  /** Share of expected income this section's budget takes. */
  pctOfIncome: number;
  /** Budget as a share of its target, capped at 100. */
  barPct: number;
  status: SectionStatus;
};

/** Per-section totals against the split targets of expected income. */
export function sectionPlans(lineBudgets: Record<string, number>, expectedCents: number, split: Split): SectionPlan[] {
  return PLAN.map((section) => {
    const totalCents = section.lines.reduce((acc, l) => acc + (lineBudgets[l.id] ?? 0), 0);
    const targetCents = Math.round((expectedCents * split[section.id]) / 100);
    let status: SectionStatus = { kind: "none" };
    if (totalCents > 0) {
      const diff = totalCents - targetCents;
      if (diff === 0) status = { kind: "on" };
      else if (section.id === "invest") status = diff < 0 ? { kind: "short", cents: -diff } : { kind: "above", cents: diff };
      else status = diff > 0 ? { kind: "over", cents: diff } : { kind: "under", cents: -diff };
    }
    return {
      id: section.id,
      totalCents,
      targetCents,
      splitPct: split[section.id],
      pctOfIncome: expectedCents > 0 ? (totalCents / expectedCents) * 100 : 0,
      barPct: Math.min(targetCents > 0 ? (totalCents / targetCents) * 100 : 0, 100),
      status,
    };
  });
}

/** Total budget and what is left to save of the expected income (PRD P4). */
export function planLineTotals(
  lineBudgets: Record<string, number>,
  expectedCents: number,
): { totalCents: number; leftToSaveCents: number } {
  const totalCents = PLAN_LINES.reduce((acc, l) => acc + (lineBudgets[l.id] ?? 0), 0);
  return { totalCents, leftToSaveCents: expectedCents - totalCents };
}

/** Board column key of expenses that have no plan line yet. */
export const UNASSIGNED_KEY = "__unassigned";

export type LineStat = CategoryStat & {
  /** Column key: the plan line id, or UNASSIGNED_KEY. */
  key: string;
  lineId: string | null;
  sectionId: SectionId | null;
};

/**
 * Expenses board columns (PRD §7.10 S2): one per plan line in budget-page order, then
 * Unassigned when some expenses have no line. A line's budget is its plan amount for this
 * month plus any carry-over; a line with only carry-over still gets a status.
 */
export function lineBreakdown(
  month: MonthData,
  lineBudgets: Record<string, number> = {},
  carry: Record<string, number> = {},
): LineStat[] {
  const entries = entriesOfType(month, "Out");
  const typeTotal = sumCents(entries);
  const stat = (
    key: string,
    name: string,
    index: number,
    items: Entry[],
    colors: { solid: string; tint: string },
    lineId: string | null,
    sectionId: SectionId | null,
  ): LineStat => {
    const totalCents = sumCents(items);
    const planned = lineId ? lineBudgets[lineId] : undefined;
    const carried = lineId ? carry[lineId] : undefined;
    return {
      key,
      name,
      index,
      color: colors.solid,
      tint: colors.tint,
      count: items.length,
      totalCents,
      sharePct: typeTotal ? (totalCents / typeTotal) * 100 : 0,
      budget: planned == null && carried == null ? null : budgetStatus(totalCents, planned ?? 0, carried ?? 0),
      lineId,
      sectionId,
    };
  };
  const stats = PLAN_LINES.map((line, index) => {
    const section = getSection(line.sectionId);
    return stat(
      line.id,
      line.name,
      index,
      entries.filter((e) => e.lineId === line.id),
      { solid: section?.color ?? "", tint: section?.tint ?? "" },
      line.id,
      line.sectionId,
    );
  });
  const unassigned = entries.filter((e) => !e.lineId);
  if (unassigned.length > 0) {
    stats.push(stat(UNASSIGNED_KEY, UNASSIGNED, PLAN_LINES.length, unassigned, categoryColor(PLAN_LINES.length), null, null));
  }
  return stats;
}

export type SectionSpend = {
  id: SectionId;
  spentCents: number;
  /** Status against this month's budget plus carry-over, or null when the section has neither. */
  budget: BudgetStatus | null;
};

/** Spend per section against the viewed month's plan, including carry-over (PRD §7.10 S4). */
export function sectionSpend(
  month: MonthData,
  lineBudgets: Record<string, number>,
  carry: Record<string, number>,
): SectionSpend[] {
  const actuals = actualsByLine(month);
  return PLAN.map((section) => {
    let spent = 0;
    let planned = 0;
    let carried = 0;
    let any = false;
    for (const line of section.lines) {
      spent += actuals[line.id] ?? 0;
      if (lineBudgets[line.id] != null || carry[line.id] != null) any = true;
      planned += lineBudgets[line.id] ?? 0;
      carried += carry[line.id] ?? 0;
    }
    return { id: section.id, spentCents: spent, budget: any ? budgetStatus(spent, planned, carried) : null };
  });
}

/** A section's carry-over: the sum over its lines, and whether any line has one. */
export function sectionCarry(sectionId: SectionId, carry: Record<string, number>): { cents: number; any: boolean } {
  const lines = getSection(sectionId)?.lines ?? [];
  return {
    cents: lines.reduce((acc, l) => acc + (carry[l.id] ?? 0), 0),
    any: lines.some((l) => carry[l.id] != null),
  };
}
