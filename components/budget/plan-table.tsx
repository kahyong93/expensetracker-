"use client";

import { PLAN_GRID_LAPTOP } from "@/components/budget/plan-grid";
import { PlanRow } from "@/components/budget/plan-row";
import { Card, Overline } from "@/components/ui/card";
import type { PlanRow as PlanRowData } from "@/lib/calc";
import { centsToInput, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

type PlanTableProps = {
  rows: readonly PlanRowData[];
  monthKey: string;
  nextKey: string;
  currency: DisplayCurrency;
  isPhone: boolean;
  /** Raw strings for inputs being edited, by category name. */
  drafts: Readonly<Record<string, string>>;
  errors: Readonly<Record<string, string>>;
  onDraft: (category: string, raw: string) => void;
  onCommit: (category: string) => void;
};

/**
 * The planner table (PRD P2): one row per expense category of this month. Laptop shows an
 * overline header; on phone it is hidden and each row stacks (DESIGN_SYSTEM §8.2).
 */
export function PlanTable({ rows, monthKey, nextKey, currency, isPhone, drafts, errors, onDraft, onCommit }: PlanTableProps) {
  return (
    <Card flat padding="none" className="gap-0 px-[22px] py-2" aria-label={`${nextKey} budget by category`}>
      {isPhone ? null : (
        <div
          aria-hidden="true"
          className={cn("grid gap-4 border-b-[1.5px] border-cf-track py-3", PLAN_GRID_LAPTOP)}
        >
          <Overline>Category</Overline>
          <Overline className="text-right">{monthKey} spent</Overline>
          <Overline>{nextKey} budget</Overline>
          <span />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="m-0 py-4 text-[13px] text-pretty text-cf-ink-muted">
          No expense categories in {monthKey} yet. Add an expense to start planning {nextKey}.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map((row) => (
            <PlanRow
              key={row.name}
              row={row}
              monthKey={monthKey}
              nextKey={nextKey}
              currency={currency}
              isPhone={isPhone}
              value={drafts[row.name] ?? (row.budgetCents == null ? "" : centsToInput(row.budgetCents, currency))}
              error={errors[row.name] ?? null}
              onChange={(raw) => onDraft(row.name, raw)}
              onCommit={() => onCommit(row.name)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
