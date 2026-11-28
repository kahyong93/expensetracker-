import { describe, expect, it } from "vitest";
import {
  actualsByCategory,
  actualsByLine,
  lineBreakdown,
  sectionCarry,
  sectionSpend,
  UNASSIGNED_KEY,
  planLineRows,
  planLineTotals,
  sectionPlans,
  unassignedCents,
  balanceMood,
  biggestExpenses,
  budgetStatus,
  categoriesOf,
  categoryBreakdown,
  categoryCount,
  categoryTotal,
  donutGradient,
  donutStops,
  filterEntries,
  formatPct,
  merchantRanking,
  monthTotals,
  planRows,
  planTotals,
  shareDecimals,
  sumCents,
} from "@/lib/calc";
import { CATEGORY_PALETTE } from "@/lib/design/palette";
import { seedJan25 } from "@/lib/seed/jan25";
import type { Entry, EntryType, MonthData } from "@/lib/types";

let nextId = 1;
function entry(type: EntryType, category: string, label: string, amountCents: number, note = ""): Entry {
  return { id: `e${nextId++}`, type, category, label, amountCents, note, sectionId: null, lineId: null };
}

function month(entries: Entry[], outOrder: string[] = [], inOrder: string[] = []): MonthData {
  return { key: "Mar-25", entries, outOrder, inOrder, isSample: false };
}

/*
 * Expected Jan-25 figures, worked out from the raw seed amounts (not from lib/calc):
 * Food 151.96, Transport 117.11, Fixed & Bills 1,110.00, Shopping & Insurance 4,186.27,
 * Work 5,246.18, Reimburse 74.80, Interest 54.94.
 */
const JAN25 = {
  earned: 537592,
  spent: 556534,
  food: 15196,
  transport: 11711,
  fixed: 111000,
  shopping: 418627,
  work: 524618,
  reimburse: 7480,
  interest: 5494,
};

describe("Jan-25 sample totals (PRD §13)", () => {
  const jan = seedJan25();
  const totals = monthTotals(jan);

  it("matches the row sums, not the sheet's drifted totals", () => {
    expect(categoryTotal(jan, "Out", "Food")).toBe(JAN25.food);
    expect(categoryTotal(jan, "In", "Interest")).toBe(JAN25.interest);
  });

  it("derives Earned, Spent and Left", () => {
    expect(totals.earnedCents).toBe(JAN25.earned);
    expect(totals.spentCents).toBe(JAN25.spent);
    expect(totals.leftCents).toBe(JAN25.earned - JAN25.spent);
  });

  it("counts items and categories", () => {
    expect(totals).toMatchObject({ outCount: 66, inCount: 7, outCategoryCount: 4, inCategoryCount: 3 });
  });

  it("is overspent: saved % negative, bar full and orange", () => {
    expect(totals.savedPct).toBe(-3.5);
    expect(totals.spentRatioPct).toBeCloseTo((JAN25.spent / JAN25.earned) * 100, 10);
    expect(totals.savingBarPct).toBe(100);
    expect(totals.overspent).toBe(true);
    expect(balanceMood(totals.leftCents).tag).toBe("Left · a little over");
  });

  it("breaks expenses down by category in board order", () => {
    const rows = categoryBreakdown(jan, "Out");
    expect(rows.map((r) => [r.name, r.count, r.totalCents])).toEqual([
      ["Food", 25, JAN25.food],
      ["Transport", 25, JAN25.transport],
      ["Fixed & Bills", 3, JAN25.fixed],
      ["Shopping & Insurance", 13, JAN25.shopping],
    ]);
    expect(formatPct(rows[0].sharePct, shareDecimals("Out"))).toBe("2.7%");
    expect(rows.reduce((acc, r) => acc + r.sharePct, 0)).toBeCloseTo(100, 10);
  });

  it("breaks income down with 2-decimal shares", () => {
    const rows = categoryBreakdown(jan, "In");
    expect(rows.map((r) => r.totalCents)).toEqual([JAN25.work, JAN25.reimburse, JAN25.interest]);
    expect(formatPct(rows[0].sharePct, shareDecimals("In"))).toBe("97.59%");
  });

  it("ranks merchants by trimmed name, largest first (top 8)", () => {
    const rows = merchantRanking(jan, 8);
    expect(rows.map((r) => [r.label, r.totalCents, r.count])).toEqual([
      ["Insurance", 357825, 2],
      ["Rental", 80000, 1],
      ["Uniqlo", 40160, 5],
      ["Parent", 30000, 1],
      ["Shopee", 15763, 2],
      ["Food", JAN25.food, 25],
      ["Transport", JAN25.transport, 25],
      ["SHENGSHIONG", 2893, 2],
    ]);
    expect(rows[0].barPct).toBe(100);
    expect(rows[1].barPct).toBeCloseTo((80000 / 357825) * 100, 10);
  });

  it("lists the biggest single expenses", () => {
    const rows = biggestExpenses(jan, 10);
    expect(rows).toHaveLength(10);
    expect(rows.slice(0, 3).map((r) => r.entry.amountCents)).toEqual([329925, 80000, 30000]);
    expect(rows[0].entry.note).toBe("Policy #2");
    expect(rows[0].barPct).toBe(100);
  });
});

describe("monthTotals edge cases", () => {
  it("is all zeros for an empty month", () => {
    expect(monthTotals(month([]))).toMatchObject({
      earnedCents: 0,
      spentCents: 0,
      leftCents: 0,
      savedPct: 0,
      spentRatioPct: 0,
      savingBarPct: 0,
      overspent: false,
    });
  });

  it("treats saved % as 0 when nothing was earned (reference: ratio 0)", () => {
    const t = monthTotals(month([entry("Out", "Food", "Lunch", 500)]));
    expect(t.leftCents).toBe(-500);
    expect(t.savedPct).toBe(0);
    expect(t.spentRatioPct).toBe(0);
    expect(t.overspent).toBe(false);
  });

  it("rounds saved % to 1 decimal", () => {
    const t = monthTotals(month([entry("In", "Work", "Pay", 3000), entry("Out", "Food", "Lunch", 1000)]));
    expect(t.savedPct).toBe(66.7);
    expect(t.savingBarPct).toBeCloseTo(33.333, 3);
    expect(t.overspent).toBe(false);
    expect(balanceMood(t.leftCents).tag).toBe("Left · saved");
  });

  it("caps the saving bar at 100 when overspent", () => {
    const t = monthTotals(month([entry("In", "Work", "Pay", 1000), entry("Out", "Food", "Lunch", 1500)]));
    expect(t).toMatchObject({ spentRatioPct: 150, savingBarPct: 100, overspent: true, savedPct: -50 });
  });

  it("counts spending of exactly the income as not overspent", () => {
    const t = monthTotals(month([entry("In", "Work", "Pay", 1000), entry("Out", "Food", "Lunch", 1000)]));
    expect(t.overspent).toBe(false);
    expect(balanceMood(t.leftCents).tag).toBe("Left · saved");
  });
});

describe("budgetStatus (PRD §8 budget use)", () => {
  it("shows the share used and what is left", () => {
    expect(budgetStatus(5000, 10000)).toEqual({ budgetCents: 10000, spentCents: 5000, usePct: 50, over: false, diffCents: 5000, carryCents: 0 });
  });

  it("is full but not over when spent equals budget", () => {
    expect(budgetStatus(10000, 10000)).toMatchObject({ usePct: 100, over: false, diffCents: 0 });
  });

  it("caps at 100 and reports the overrun", () => {
    expect(budgetStatus(15000, 10000)).toMatchObject({ usePct: 100, over: true, diffCents: 5000 });
  });

  it("treats a zero budget as fully used (reference: b ? t/b*100 : 100)", () => {
    expect(budgetStatus(0, 0)).toMatchObject({ usePct: 100, over: false });
    expect(budgetStatus(1, 0)).toMatchObject({ usePct: 100, over: true, diffCents: 1 });
    expect(budgetStatus(8000, 10000, -3000)).toMatchObject({ budgetCents: 7000, over: true, diffCents: 1000, carryCents: -3000 });
  });
});

describe("categories and breakdown", () => {
  it("keeps saved order and appends categories only found on entries", () => {
    const m = month([entry("Out", "Pets", "Food", 100), entry("Out", "Food", "Lunch", 100)], ["Food", "Transport"]);
    expect(categoriesOf(m, "Out")).toEqual(["Food", "Transport", "Pets"]);
    expect(categoriesOf(m, "In")).toEqual([]);
  });

  it("assigns palette colours by board index, cycling every 6", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const rows = categoryBreakdown(month([], names), "Out");
    expect(rows[0].color).toBe(CATEGORY_PALETTE[0].solid);
    expect(rows[6].color).toBe(CATEGORY_PALETTE[0].solid);
    expect(rows[6].tint).toBe(CATEGORY_PALETTE[0].tint);
  });

  it("gives empty categories a 0 share", () => {
    const rows = categoryBreakdown(month([], ["Food"]), "Out");
    expect(rows[0]).toMatchObject({ count: 0, totalCents: 0, sharePct: 0, budget: null });
  });

  it("attaches budget status to expenses only", () => {
    const m = month([entry("Out", "Food", "Lunch", 2500), entry("In", "Food", "Refund", 100)], ["Food"], ["Food"]);
    expect(categoryBreakdown(m, "Out", { Food: 10000 })[0].budget).toMatchObject({ usePct: 25, over: false });
    expect(categoryBreakdown(m, "In", { Food: 10000 })[0].budget).toBeNull();
  });

  it("counts and totals one category", () => {
    const m = month([entry("Out", "Food", "A", 100), entry("Out", "Food", "B", 250), entry("In", "Food", "C", 999)]);
    expect(categoryCount(m, "Out", "Food")).toBe(2);
    expect(categoryTotal(m, "Out", "Food")).toBe(350);
    expect(sumCents(m.entries)).toBe(1349);
  });
});

describe("donut", () => {
  it("has no gradient when nothing was spent", () => {
    expect(donutGradient(categoryBreakdown(month([], ["Food"]), "Out"))).toBeNull();
  });

  it("builds cumulative stops and skips empty slices", () => {
    const m = month(
      [entry("Out", "Food", "A", 2500), entry("Out", "Bills", "B", 7500)],
      ["Food", "Empty", "Bills"],
    );
    const stats = categoryBreakdown(m, "Out");
    expect(donutStops(stats).map((s) => [s.fromPct, s.toPct])).toEqual([
      [0, 25],
      [25, 25],
      [25, 100],
    ]);
    expect(donutGradient(stats)).toBe(
      `conic-gradient(${CATEGORY_PALETTE[0].solid} 0% 25%, ${CATEGORY_PALETTE[2].solid} 25% 100%)`,
    );
  });
});

describe("merchantRanking", () => {
  it("groups names after trimming and keeps the first category seen", () => {
    const m = month([
      entry("Out", "Shopping", "Uniqlo", 1000),
      entry("Out", "Gifts", " Uniqlo ", 500),
      entry("In", "Work", "Uniqlo", 99999),
    ]);
    expect(merchantRanking(m, 8)).toEqual([{ label: "Uniqlo", totalCents: 1500, count: 2, category: "Shopping", barPct: 100 }]);
  });

  it("returns nothing for a month without expenses", () => {
    expect(merchantRanking(month([]), 8)).toEqual([]);
    expect(biggestExpenses(month([]), 10)).toEqual([]);
  });
});

describe("filterEntries (PRD B2 search)", () => {
  const entries = [entry("Out", "Food", "Kopi", 120, "Morning"), entry("Out", "Food", "Lunch", 500, "with team")];

  it("matches label or note, ignoring case", () => {
    expect(filterEntries(entries, "kopi").map((e) => e.label)).toEqual(["Kopi"]);
    expect(filterEntries(entries, "TEAM").map((e) => e.label)).toEqual(["Lunch"]);
    expect(filterEntries(entries, "  morning ").map((e) => e.label)).toEqual(["Kopi"]);
  });

  it("returns a copy of everything for a blank query", () => {
    const all = filterEntries(entries, "  ");
    expect(all).toEqual(entries);
    expect(all).not.toBe(entries);
  });
});

describe("budget planner (PRD P2–P5)", () => {
  const m = month(
    [entry("Out", "Food", "A", 10000), entry("Out", "Bills", "B", 40000), entry("Out", "Fun", "C", 5000)],
    ["Food", "Bills", "Fun", "Empty"],
  );

  it("compares each category's actual with next month's budget", () => {
    const rows = planRows(m, { Food: 8000, Bills: 40000, Fun: 6000 });
    expect(rows.map((r) => [r.name, r.diff])).toEqual([
      ["Food", { kind: "less", cents: 2000 }],
      ["Bills", { kind: "same" }],
      ["Fun", { kind: "more", cents: 1000 }],
      ["Empty", { kind: "none" }],
    ]);
  });

  it("puts all bars on one scale (largest actual or budget)", () => {
    const rows = planRows(m, { Food: 80000 });
    expect(rows[0]).toMatchObject({ actualBarPct: 12.5, budgetBarPct: 100, budgetCents: 80000 });
    expect(rows[1]).toMatchObject({ actualBarPct: 50, budgetBarPct: 0, budgetCents: null });
  });

  it("does not divide by zero for an empty month", () => {
    const rows = planRows(month([], ["Food"]), {});
    expect(rows[0]).toMatchObject({ actualBarPct: 0, budgetBarPct: 0 });
  });

  it("totals budgets for current categories only, and left to save", () => {
    const budgets = { Food: 10000, Bills: 5000, Gone: 99999 };
    expect(planTotals(["Food", "Bills", "Fun"], budgets, 20000)).toEqual({ totalCents: 15000, leftToSaveCents: 5000 });
    expect(planTotals(["Food"], budgets, 0)).toEqual({ totalCents: 10000, leftToSaveCents: -10000 });
  });

  it("fills with actuals, including 0 for empty categories", () => {
    expect(actualsByCategory(m)).toEqual({ Food: 10000, Bills: 40000, Fun: 5000, Empty: 0 });
  });
});

describe("formatPct", () => {
  it("formats with the given decimals", () => {
    expect(formatPct(12.36)).toBe("12.4%");
    expect(formatPct(5, 2)).toBe("5.00%");
    expect(formatPct(0)).toBe("0.0%");
  });
});

describe("budget plan by line", () => {
  const month = (entries: Entry[]): MonthData => ({ key: "Jan-25", isSample: false, outOrder: [], inOrder: [], entries });
  const spend = (label: string, cents: number, lineId: string | null, sectionId: string | null = lineId ? "needs" : null): Entry => ({
    id: label,
    type: "Out",
    category: "x",
    label,
    amountCents: cents,
    note: "",
    sectionId,
    lineId,
  });
  const split = { needs: 50, invest: 20, fun: 30 };

  it("sums spend per saved line id and reports unassigned spend separately", () => {
    const m = month([spend("a", 500, "groceries"), spend("b", 300, "groceries"), spend("c", 700, "rent"), spend("d", 90, null)]);
    expect(actualsByLine(m)).toEqual({ groceries: 800, rent: 700 });
    expect(unassignedCents(m)).toBe(90);
  });

  it("ignores income entries", () => {
    const m = month([{ ...spend("pay", 9000, null), type: "In" }]);
    expect(actualsByLine(m)).toEqual({});
    expect(unassignedCents(m)).toBe(0);
  });

  it("builds one row per plan line with the budget difference", () => {
    const rows = planLineRows(month([spend("a", 800, "groceries")]), { groceries: 1000, rent: 50000 });
    expect(rows).toHaveLength(23);
    expect(rows[0].id).toBe("rent");
    expect(rows.find((r) => r.id === "groceries")).toMatchObject({ actualCents: 800, budgetCents: 1000, diff: { kind: "more", cents: 200 } });
    expect(rows.find((r) => r.id === "util")).toMatchObject({ actualCents: 0, budgetCents: null, diff: { kind: "none" } });
  });

  it("compares each section with its split target of expected income", () => {
    const plans = sectionPlans({ rent: 60000, groceries: 10000, stocks: 5000, dining: 40000 }, 200000, split);
    const by = (id: string) => plans.find((p) => p.id === id)!;
    expect(by("needs")).toMatchObject({ totalCents: 70000, targetCents: 100000, status: { kind: "under", cents: 30000 } });
    expect(by("invest")).toMatchObject({ totalCents: 5000, targetCents: 40000, status: { kind: "short", cents: 35000 } });
    expect(by("fun")).toMatchObject({ totalCents: 40000, targetCents: 60000, status: { kind: "under", cents: 20000 } });
    expect(sectionPlans({ rent: 120000 }, 200000, split)[0].status).toEqual({ kind: "over", cents: 20000 });
    expect(sectionPlans({ rent: 100000 }, 200000, split)[0].status).toEqual({ kind: "on" });
    expect(sectionPlans({}, 200000, split)[0].status).toEqual({ kind: "none" });
  });

  it("treats going above the investment target as good, not over", () => {
    expect(sectionPlans({ stocks: 50000 }, 200000, split)[1].status).toEqual({ kind: "above", cents: 10000 });
  });

  it("totals the plan and what is left to save", () => {
    expect(planLineTotals({ rent: 60000, stocks: 5000 }, 100000)).toEqual({ totalCents: 65000, leftToSaveCents: 35000 });
  });

  it("builds expense board columns per line, with Unassigned last and only when needed", () => {
    const m = month([spend("a", 800, "groceries"), spend("b", 200, "groceries"), spend("c", 1000, "rent")]);
    const stats = lineBreakdown(m, { groceries: 2000 });
    expect(stats).toHaveLength(23);
    expect(stats[0]).toMatchObject({ key: "rent", name: "Rent / mortgage", count: 1, totalCents: 1000, sharePct: 50 });
    expect(stats.find((s) => s.key === "groceries")).toMatchObject({ count: 2, totalCents: 1000, budget: { over: false } });
    expect(stats.at(-1)?.key).not.toBe(UNASSIGNED_KEY);

    const withUnassigned = lineBreakdown(month([spend("d", 90, null)]));
    expect(withUnassigned).toHaveLength(24);
    expect(withUnassigned.at(-1)).toMatchObject({ key: UNASSIGNED_KEY, name: "Unassigned", count: 1, lineId: null, sectionId: null });
  });

  it("adds carry-over to a line's budget, and carry alone is enough for a status", () => {
    const m = month([spend("a", 1500, "groceries"), spend("b", 100, "rent")]);
    const stats = lineBreakdown(m, { groceries: 1000 }, { groceries: 300, rent: -50 });
    expect(stats.find((s) => s.key === "groceries")?.budget).toMatchObject({ budgetCents: 1300, over: true, diffCents: 200, carryCents: 300 });
    expect(stats.find((s) => s.key === "rent")?.budget).toMatchObject({ budgetCents: -50, over: true, carryCents: -50 });
    expect(stats.find((s) => s.key === "util")?.budget).toBeNull();
  });

  it("sums a section's spend against its budget plus carry", () => {
    const m = month([spend("a", 400, "groceries"), spend("b", 700, "rent"), spend("c", 50, null)]);
    const secs = sectionSpend(m, { groceries: 500, rent: 600 }, { rent: 100 });
    const needs = secs.find((s) => s.id === "needs")!;
    expect(needs.spentCents).toBe(1100);
    expect(needs.budget).toMatchObject({ budgetCents: 1200, over: false, diffCents: 100, carryCents: 100 });
    expect(secs.find((s) => s.id === "fun")).toMatchObject({ spentCents: 0, budget: null });
  });

  it("carries into plan rows and sums a section's carry", () => {
    const rows = planLineRows(month([]), { rent: 100 }, { rent: 40, groceries: -10 });
    expect(rows.find((r) => r.id === "rent")?.carryCents).toBe(40);
    expect(rows.find((r) => r.id === "util")?.carryCents).toBeNull();
    expect(sectionCarry("needs", { rent: 40, groceries: -10 })).toEqual({ cents: 30, any: true });
    expect(sectionCarry("fun", { rent: 40 })).toEqual({ cents: 0, any: false });
  });
});
