/**
 * CSV export (PRD X1, CLAUDE.md §9): quote every field and prefix cells starting with
 * = + - @ with ' to stop formula injection.
 */
import { centsToInput, type DisplayCurrency } from "@/lib/money";
import { getSection, PLAN_LINES } from "@/lib/plan";
import type { MonthData } from "@/lib/types";

export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvFileName(monthKey: string): string {
  return `${monthKey}_Cashflow.csv`;
}

export function buildMonthCsv(
  month: MonthData,
  currency: DisplayCurrency,
  /** Next month's budgets in cents, by plan line id. */
  next: { key: string; budgets: Record<string, number> },
): string {
  const rows: string[][] = [
    ["Month", "Type", "Category", "Item", "Amount (SGD)", `Amount (${currency.code})`, "Note"],
    ...month.entries.map((e) => [
      month.key,
      e.type,
      e.category,
      e.label,
      centsToInput(e.amountCents),
      centsToInput(e.amountCents, currency),
      e.note,
    ]),
    // One row per budgeted line, in plan order: the section is the category, the line is the item.
    ...PLAN_LINES.filter((l) => next.budgets[l.id] != null).map((l) => [
      next.key,
      "Budget",
      getSection(l.sectionId)?.title ?? "",
      l.name,
      centsToInput(next.budgets[l.id]),
      centsToInput(next.budgets[l.id], currency),
      "",
    ]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
