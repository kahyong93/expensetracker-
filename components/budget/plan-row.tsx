"use client";

import { useId, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { PlanDiff, PlanLineRow } from "@/lib/calc";
import { centsToInput, formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PLAN_GRID_LAPTOP, PLAN_GRID_PHONE } from "@/components/budget/plan-grid";

/** Difference line under the bars (PRD P2). */
function diffLabel(diff: PlanDiff, monthKey: string, currency: DisplayCurrency): string {
  switch (diff.kind) {
    case "none":
      return "No budget set yet";
    case "same":
      return `Same as ${monthKey}`;
    case "less":
      return `${formatMoney(diff.cents, currency)} less than ${monthKey}`;
    case "more":
      return `${formatMoney(diff.cents, currency)} more than ${monthKey}`;
  }
}

type PlanRowProps = {
  row: PlanLineRow;
  monthKey: string;
  nextKey: string;
  currency: DisplayCurrency;
  isPhone: boolean;
  /** Raw input value: the draft while editing, else the stored budget. */
  value: string;
  error: string | null;
  onChange: (raw: string) => void;
  onCommit: () => void;
};

/**
 * One planner row: name, this month's spend, next month's budget input, the comparison
 * bars (actual grey, budget in the category colour, same scale) and the diff line.
 * Laptop: 4 columns. Phone: name + actual on top, input and bars full width.
 */
export function PlanRow({ row, monthKey, nextKey, currency, isPhone, value, error, onChange, onCommit }: PlanRowProps) {
  const inputId = useId();
  const diffId = `${inputId}-diff`;
  const errorId = `${inputId}-error`;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
    }
  }

  return (
    <li
      className={cn(
        "grid items-center gap-x-4 gap-y-3 border-b-[1.5px] border-cf-track py-3",
        isPhone ? PLAN_GRID_PHONE : PLAN_GRID_LAPTOP,
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
        <span className="min-w-0">
          <span className="block truncate">{row.name}</span>
          {row.hint ? <span className="block truncate text-[11px] font-bold text-cf-ink-muted">{row.hint}</span> : null}
        </span>
      </span>

      <span className="text-right text-sm font-bold text-cf-ink-soft">
        <span className="sr-only">{monthKey} spent: </span>
        {formatMoney(row.actualCents, currency)}
      </span>

      <div className={cn("flex flex-col gap-1", isPhone && "col-span-full")}>
        <label htmlFor={inputId} className="flex items-center gap-1.5 text-[13px] font-extrabold text-cf-ink-muted">
          <span aria-hidden="true">{currency.sym}</span>
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            size="sm"
            weight="bold"
            aria-label={`${row.name} budget for ${nextKey} (${currency.sym})`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${diffId}` : diffId}
            placeholder={centsToInput(row.actualCents, currency)}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onCommit}
            onKeyDown={onKeyDown}
            className={cn("w-full", isPhone && "min-h-11")}
          />
        </label>
        {error ? (
          <span id={errorId} className="text-[11px] font-bold text-cf-invalid-text">
            {error}
          </span>
        ) : null}
      </div>

      <div className={cn("flex flex-col gap-1", isPhone && "col-span-full")}>
        <ProgressBar value={row.actualBarPct} height={6} fill="neutral" />
        <ProgressBar value={row.budgetBarPct} height={6} fill={{ color: row.color }} />
        <span id={diffId} className="text-[11px] font-bold text-cf-ink-muted">
          {diffLabel(row.diff, monthKey, currency)}
        </span>
      </div>
    </li>
  );
}
