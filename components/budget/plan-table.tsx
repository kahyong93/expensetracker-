"use client";

import { PLAN_GRID_LAPTOP } from "@/components/budget/plan-grid";
import { PlanRow } from "@/components/budget/plan-row";
import { Card, Overline } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { PlanLineRow, SectionPlan, SectionStatus } from "@/lib/calc";
import { formatMoney, centsToInput, type DisplayCurrency } from "@/lib/money";
import { PLAN } from "@/lib/plan";
import { cn } from "@/lib/utils";

type PlanTableProps = {
  rows: readonly PlanLineRow[];
  sections: readonly SectionPlan[];
  monthKey: string;
  nextKey: string;
  currency: DisplayCurrency;
  isPhone: boolean;
  /** This month's expenses that have no plan line yet (not shown in any row). */
  unassignedCents: number;
  /** Raw strings for inputs being edited, by plan line id. */
  drafts: Readonly<Record<string, string>>;
  errors: Readonly<Record<string, string>>;
  onDraft: (lineId: string, raw: string) => void;
  onCommit: (lineId: string) => void;
};

/** Status line under a section's total (reference planSections). */
export function sectionStatusText(status: SectionStatus, splitPct: number, currency: DisplayCurrency): string {
  const f = (cents: number) => formatMoney(cents, currency);
  switch (status.kind) {
    case "none":
      return "Nothing planned yet";
    case "on":
      return `Right on the ${splitPct}% target`;
    case "short":
      return `${f(status.cents)} short of the ${splitPct}% target`;
    case "above":
      return `${f(status.cents)} above target, nice`;
    case "over":
      return `${f(status.cents)} over the ${splitPct}% target`;
    case "under":
      return `${f(status.cents)} under the ${splitPct}% target`;
  }
}

/**
 * The planner (PRD P2, §7.10): one block per section with its total against the split
 * target, then one row per plan line. Laptop shows an overline header; on phone it is
 * hidden and each row stacks (DESIGN_SYSTEM §8.2).
 */
export function PlanTable({
  rows,
  sections,
  monthKey,
  nextKey,
  currency,
  isPhone,
  unassignedCents,
  drafts,
  errors,
  onDraft,
  onCommit,
}: PlanTableProps) {
  return (
    <div className="flex flex-col gap-5">
      {PLAN.map((sec) => {
        const plan = sections.find((s) => s.id === sec.id);
        if (!plan) return null;
        const over = plan.status.kind === "over";
        const good = plan.status.kind === "on" || plan.status.kind === "under" || plan.status.kind === "above";
        return (
          <Card
            key={sec.id}
            flat
            padding="none"
            className="gap-0 px-[22px] py-2"
            aria-label={`${nextKey} budget: ${sec.title}`}
          >
            <div className="flex flex-col gap-1.5 border-b-[1.5px] border-cf-track py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="m-0 font-heading text-lg font-semibold" style={{ color: sec.fg }}>
                  {sec.num}. {sec.title} <span className="text-[13px] font-bold text-cf-ink-muted">{sec.sub}</span>
                </h2>
                <span className="font-heading text-xl font-semibold">{formatMoney(plan.totalCents, currency)}</span>
              </div>
              <span className="text-xs font-bold text-cf-ink-muted">
                {plan.pctOfIncome.toFixed(0)}% of income · target {formatMoney(plan.targetCents, currency)} ({plan.splitPct}%)
              </span>
              <ProgressBar value={plan.barPct} height={6} fill={{ color: over ? "#E8794A" : sec.color }} />
              <span
                className={cn("text-xs font-extrabold", over ? "text-cf-out-tag" : good ? "text-cf-in-tag" : "text-cf-ink-muted")}
              >
                {sectionStatusText(plan.status, plan.splitPct, currency)}
              </span>
            </div>

            {isPhone ? null : (
              <div aria-hidden="true" className={cn("grid gap-4 border-b-[1.5px] border-cf-track py-3", PLAN_GRID_LAPTOP)}>
                <Overline>Category</Overline>
                <Overline className="text-right">{monthKey} spent</Overline>
                <Overline>{nextKey} budget</Overline>
                <span />
              </div>
            )}

            <ul className="m-0 flex list-none flex-col p-0">
              {rows
                .filter((row) => row.sectionId === sec.id)
                .map((row) => (
                  <PlanRow
                    key={row.id}
                    row={row}
                    monthKey={monthKey}
                    nextKey={nextKey}
                    currency={currency}
                    isPhone={isPhone}
                    value={drafts[row.id] ?? (row.budgetCents == null ? "" : centsToInput(row.budgetCents, currency))}
                    error={errors[row.id] ?? null}
                    onChange={(raw) => onDraft(row.id, raw)}
                    onCommit={() => onCommit(row.id)}
                  />
                ))}
            </ul>

            {sec.id === "fun" && unassignedCents > 0 ? (
              <p className="m-0 py-3 text-xs text-pretty text-cf-ink-muted">
                {formatMoney(unassignedCents, currency)} of {monthKey} spending did not match a line above, so it is not
                shown.
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
