"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { categoryCount, categoryTotal } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { MonthData } from "@/lib/types";
import { SAMPLE_AUDIT } from "@/lib/seed/jan25";
import { cn } from "@/lib/utils";

/**
 * Sample audit panel (PRD D7, DESIGN_SYSTEM §7.4 collapsible): explains the Food and
 * Interest discrepancies of the original Jan-25 sheet. Sample month, setting on, laptop only
 * (the caller decides). Collapsed by default.
 */
type AuditPanelProps = {
  month: MonthData;
  currency: DisplayCurrency;
};

/** Live row totals vs the sheet's total cells. Kept pure, outside JSX. */
function auditFigures(month: MonthData) {
  const foodLiveCents = categoryTotal(month, "Out", "Food");
  const interestLiveCents = categoryTotal(month, "In", "Interest");
  return {
    foodLiveCents,
    foodDiffCents: Math.abs(foodLiveCents - SAMPLE_AUDIT.foodSheetCents),
    interestLiveCents,
    interestCount: categoryCount(month, "In", "Interest"),
  };
}

export function AuditPanel({ month, currency }: AuditPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const a = auditFigures(month);
  const f = (cents: number) => formatMoney(cents, currency);

  return (
    <Card flat padding="none" className="gap-0 overflow-hidden" aria-label={`${month.key} sheet formula check`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "box-border flex w-full items-center justify-between gap-2 px-[22px] py-3.5 text-left text-cf-ink",
          "transition-[background-color] duration-120 ease-out hover:bg-cf-surface-hover",
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-6 place-items-center rounded-cf-xs bg-cf-bal-tint text-[13px] font-extrabold text-cf-bal-tag"
          >
            !
          </span>
          <span className="text-sm font-extrabold">{month.key} sheet formula check</span>
        </span>
        <span className="text-xs font-extrabold text-cf-primary">{open ? "Hide" : "Show"}</span>
      </button>
      <div
        id={bodyId}
        hidden={!open}
        className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 px-[22px] pt-1 pb-5 text-[13px] leading-normal"
      >
        <div className="rounded-cf-inner border-[1.5px] border-cf-line bg-cf-surface-hover p-3.5">
          <div className="mb-1 font-extrabold">Food total</div>
          All Food rows add up to <b>{f(a.foodLiveCents)}</b>. The sheet&apos;s total cell shows{" "}
          <b>{f(SAMPLE_AUDIT.foodSheetCents)}</b>, a difference of {f(a.foodDiffCents)} from rows left out of the range.
        </div>
        <div className="rounded-cf-inner border-[1.5px] border-cf-line bg-cf-surface-hover p-3.5">
          <div className="mb-1 font-extrabold">Interest total</div>
          All {a.interestCount} Interest rows add up to <b>{f(a.interestLiveCents)}</b>. The sheet&apos;s total cell
          shows <b>{f(SAMPLE_AUDIT.interestSheetCents)}</b>.
        </div>
      </div>
    </Card>
  );
}
