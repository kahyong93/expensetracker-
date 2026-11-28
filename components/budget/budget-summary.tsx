"use client";

import { useId, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type BudgetSummaryProps = {
  monthKey: string;
  nextKey: string;
  currency: DisplayCurrency;
  isPhone: boolean;
  aiNote: string | null;
  aiBusy: boolean;
  /** No expense with a plan line this month: nothing to fill or suggest. */
  noCategories: boolean;
  /** Nothing to clear: no budgets, no note, no drafts. */
  nothingToClear: boolean;
  expectedValue: string;
  expectedError: string | null;
  totalCents: number;
  leftToSaveCents: number;
  onFill: () => void;
  onSuggest: () => void;
  onClear: () => void;
  onExpectedChange: (raw: string) => void;
  onExpectedCommit: () => void;
};

/**
 * Budget header card (PRD P1, P3–P7, AI-4): title, explainer, Fill / ✦ Suggest with AI /
 * Clear, the AI note, and Expected income / Total budget / Left to save.
 */
export function BudgetSummary({
  monthKey,
  nextKey,
  currency,
  isPhone,
  aiNote,
  aiBusy,
  noCategories,
  nothingToClear,
  expectedValue,
  expectedError,
  totalCents,
  leftToSaveCents,
  onFill,
  onSuggest,
  onClear,
  onExpectedChange,
  onExpectedCommit,
}: BudgetSummaryProps) {
  const expectedId = useId();
  const expectedErrorId = `${expectedId}-error`;
  const buttonHit = isPhone ? "min-h-11" : undefined;

  function onExpectedKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onExpectedCommit();
    }
  }

  return (
    <Card className="flex-row flex-wrap justify-between gap-5">
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <h1 className="m-0 font-heading text-[26px] font-semibold">Budget for {nextKey}</h1>
        <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
          Set a limit per category, using {monthKey} spending as a guide. When you create {nextKey}, these limits
          appear as progress bars on its dashboard and board.
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className={buttonHit} disabled={noCategories} onClick={onFill}>
            Fill with {monthKey} amounts
          </Button>
          <Button
            variant="soft"
            size="sm"
            className={buttonHit}
            disabled={aiBusy || noCategories}
            aria-busy={aiBusy || undefined}
            onClick={onSuggest}
          >
            {aiBusy ? (
              "Thinking…"
            ) : (
              <>
                <span aria-hidden="true">✦</span>Suggest with AI
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" className={buttonHit} disabled={nothingToClear} onClick={onClear}>
            Clear
          </Button>
        </div>
        {aiNote ? (
          <p className="m-0 mt-1.5 rounded-cf-inner bg-cf-soft-note px-3 py-2.5 text-[13px] leading-[1.45] text-pretty text-cf-note-ink">
            <b>AI note:</b> {aiNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-x-7 gap-y-3.5">
        <div className="flex flex-col gap-1">
          <label htmlFor={expectedId} className="text-xs font-extrabold text-cf-ink-muted">
            Expected income
          </label>
          <Input
            id={expectedId}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            surface="income"
            aria-invalid={expectedError ? true : undefined}
            aria-describedby={expectedError ? expectedErrorId : undefined}
            value={expectedValue}
            onChange={(event) => onExpectedChange(event.target.value)}
            onBlur={onExpectedCommit}
            onKeyDown={onExpectedKeyDown}
            className={cn("w-[130px] px-2.5 py-1.5 font-heading text-xl font-semibold", isPhone && "min-h-11")}
          />
          {expectedError ? (
            <span id={expectedErrorId} className="max-w-[130px] text-[11px] font-bold text-cf-invalid-text">
              {expectedError}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-extrabold text-cf-ink-muted">Total budget</span>
          <span className="font-heading text-2xl font-semibold text-cf-out-tag">{formatMoney(totalCents, currency)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-extrabold text-cf-ink-muted">Left to save</span>
          <span className="font-heading text-2xl font-semibold">{formatMoney(leftToSaveCents, currency)}</span>
        </div>
      </div>
    </Card>
  );
}
