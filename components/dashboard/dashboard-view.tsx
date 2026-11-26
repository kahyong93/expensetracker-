"use client";

import { AuditPanel } from "@/components/dashboard/audit-panel";
import { TopSpending } from "@/components/dashboard/top-spending";
import { WhatCameIn } from "@/components/dashboard/what-came-in";
import { WhereItWent } from "@/components/dashboard/where-it-went";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { MonthMissing } from "@/components/shell/month-missing";
import { categoryBreakdown, donutGradient, entriesOfType, monthTotals } from "@/lib/calc";
import { monthHref } from "@/lib/months";

/**
 * Dashboard body (PRD §7.4 D4–D7). The KPI row (D1–D3) is mounted by the month layout
 * above every tab. The month layout loads the data on the server.
 */
export function DashboardView() {
  const view = useMonthView();
  const { isPhone } = useLayoutMode();

  if (view.status === "missing") return <MonthMissing monthKey={view.monthKey} tab="dashboard" />;

  const { month, monthKey, currency, budgets, settings } = view;
  const totals = monthTotals(month);
  const outStats = categoryBreakdown(month, "Out", budgets);
  const inStats = categoryBreakdown(month, "In");
  const showAudit = month.isSample && settings.showAudit && !isPhone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Dashboard for {monthKey}</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-5">
        <WhereItWent
          monthKey={monthKey}
          categories={outStats}
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
