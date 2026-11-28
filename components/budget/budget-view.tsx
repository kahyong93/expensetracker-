"use client";

import { BudgetPlanner } from "@/components/budget/budget-planner";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { MonthMissing } from "@/components/shell/month-missing";

/** Budget tab: reads the server-loaded month from the data provider, then renders the planner. */
export function BudgetView() {
  const view = useMonthView();
  if (view.status === "missing") return <MonthMissing monthKey={view.monthKey} tab="budget" />;
  return (
    <BudgetPlanner
      key={view.monthKey}
      monthKey={view.monthKey}
      nextKey={view.nextKey}
      month={view.month}
      plan={view.nextPlan}
      currency={view.currency}
      planPrefs={view.planPrefs}
    />
  );
}
