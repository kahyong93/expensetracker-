"use client";

import { AuditPanel } from "@/components/dashboard/audit-panel";
import { TopSpending } from "@/components/dashboard/top-spending";
import { WhatCameIn } from "@/components/dashboard/what-came-in";
import { WhereItWent } from "@/components/dashboard/where-it-went";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { MonthMissing } from "@/components/shell/month-missing";
import { categoryBreakdown, donutGradient, entriesOfType, lineBreakdown, monthTotals, sectionSpend } from "@/lib/calc";
import { categoryColor } from "@/lib/design/palette";
import { monthHref } from "@/lib/months";

/**
 * Dashboard body (PRD §7.4 D4–D7). The KPI row (D1–D3) is mounted by the month layout
 * above every tab. The month layout loads the data on the server.
 */
export function DashboardView() {
  const view = useMonthView();
  const { isPhone } = useLayoutMode();

  if (view.status === "missing") return <MonthMissing monthKey={view.monthKey} tab="dashboard" />;

  const { month, monthKey, currency, plan, carry, settings } = view;
  const totals = monthTotals(month);
  // One row per plan line that has spend or a budget (incl. carry-over) this month, then Unassigned.
  // Each row gets its own palette colour so the donut slices stay distinguishable.
  const outStats = lineBreakdown(month, plan.lines, carry.byLine)
    .filter((s) => s.count > 0 || s.budget != null)
    .map((s, i) => ({ ...s, index: i, color: categoryColor(i).solid, tint: categoryColor(i).tint }));
  const sections = sectionSpend(month, plan.lines, carry.byLine);
  const inStats = categoryBreakdown(month, "In");
  const showAudit = month.isSample && settings.showAudit && !isPhone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Dashboard for {monthKey}</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-5">
        <WhereItWent
          monthKey={monthKey}
          categories={outStats}
          sections={sections}
          donutGradient={donutGradient(outStats)}
          spentCents={totals.spentCents}
          currency={currency}
          expensesHref={monthHref(monthKey, "expenses")}
          isPhone={isPhone}
        />
        <WhatCameIn
          monthKey={monthKey}
          categories={inStats}
          lines={entriesOfType(month, "In")}
          currency={currency}
          incomeHref={monthHref(monthKey, "income")}
          isPhone={isPhone}
        />
      </div>
      <TopSpending month={month} currency={currency} isPhone={isPhone} />
      {showAudit ? <AuditPanel month={month} currency={currency} /> : null}
    </div>
  );
}
