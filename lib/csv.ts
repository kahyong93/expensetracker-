/**
 * CSV export (PRD X1, CLAUDE.md §9): quote every field and prefix cells starting with
 * = + - @ with ' to stop formula injection.
 */
import { centsToInput, type DisplayCurrency } from "@/lib/money";
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
    ...Object.entries(next.budgets).map(([category, cents]) => [
      next.key,
      "Budget",
      category,
      "",
      centsToInput(cents),
      centsToInput(cents, currency),
      "",
    ]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
