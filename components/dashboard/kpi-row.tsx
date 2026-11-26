"use client";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { Mascot } from "@/components/icons/mascot";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { ProgressBar } from "@/components/ui/progress-bar";
import { balanceMood, formatPct, monthTotals } from "@/lib/calc";
import { formatMoney } from "@/lib/money";

/**
 * Earned / Spent / Left (PRD D1–D3). Shown above every tab of a month, so it is mounted
 * by the month layout, not by the dashboard page. Laptop: 3 KPI cards. Phone: the
 * compact strip (DESIGN_SYSTEM §7.4, §8.2). Renders nothing until the month is ready.
 */
export function KpiRow() {
  const view = useMonthView();
  const { isPhone } = useLayoutMode();
  if (view.status !== "ready") return null;

  const totals = monthTotals(view.month);
  const { tag, mood } = balanceMood(totals.leftCents);
  const earned = formatMoney(totals.earnedCents, view.currency);
  const spent = formatMoney(totals.spentCents, view.currency);
  const left = formatMoney(totals.leftCents, view.currency);
  const savedLabel = `${formatPct(totals.savedPct, 1)} saved`;
  const barFill = totals.overspent ? "overspent" : "saving";

  if (isPhone) {
    return (
      <KpiStrip
        earned={earned}
        spent={spent}
        left={left}
        savingBarPct={totals.savingBarPct}
        overspent={totals.overspent}
        savedLabel={savedLabel}
        mood={mood}
      />
    );
  }

  return (
    <section aria-label="Month totals" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      <KpiCard
        role="in"
        tag="Earned"
        amount={earned}
        aside={<Mascot cheek="in" />}
        footer={
          <span className="text-xs font-bold text-cf-in-sub">
            {totals.inCount} items · {totals.inCategoryCount} categories
          </span>
        }
      />
      <KpiCard
        role="out"
        tag="Spent"
        amount={spent}
        aside={<Mascot cheek="out" />}
        footer={
          <span className="text-xs font-bold text-cf-out-sub">
            {totals.outCount} items · {totals.outCategoryCount} categories
          </span>
        }
      />
      <KpiCard
        role="bal"
        tag={tag}
        amount={left}
        aside={
          <span aria-hidden="true" className="text-[15px] font-extrabold whitespace-nowrap text-cf-bal-tag">
            {mood}
          </span>
        }
        footer={
          <div className="flex items-center gap-2">
            <ProgressBar value={totals.savingBarPct} height={10} fill={barFill} track="white" className="flex-1" />
            <span className="text-xs font-extrabold text-cf-bal-tag">{savedLabel}</span>
          </div>
        }
      />
    </section>
  );
}
