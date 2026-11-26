"use client";

import { BoardView } from "@/components/board/board-view";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { MonthMissing } from "@/components/shell/month-missing";
import type { EntryType } from "@/lib/types";

/**
 * The Expenses / Income board (PRD §7.5). Shared by both pages:
 *   <CategoryBoard type="Out" />   expenses
 *   <CategoryBoard type="In" />    income
 * The month layout loads the data on the server; this reads it from the data provider.
 */
export function CategoryBoard({ type }: { type: EntryType }) {
  const view = useMonthView();

  if (view.status === "missing") {
    return <MonthMissing monthKey={view.monthKey} tab={type === "Out" ? "expenses" : "income"} />;
  }
  // Keyed by month so search, open columns and modals reset when the month changes.
  return <BoardView key={view.monthKey} type={type} view={view} />;
}
