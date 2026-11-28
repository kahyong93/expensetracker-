import { BOARD_COPY } from "@/components/board/board-copy";
import { carryText } from "@/components/budget/carry-text";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { BudgetStatus } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * One section's spend against its budget for the viewed month (PRD §7.10 S4): a bar and a
 * line reading "S$x left of S$y budget" or "S$x over the S$y budget", with any carried-over
 * amount already included in the budget. Without a budget it only shows what was spent.
 * Used under section headings on the Expenses board and on the Dashboard.
 */
export function SectionSpend({
  spentCents,
  budget,
  currency,
  className,
}: {
  spentCents: number;
  budget: BudgetStatus | null;
  currency: DisplayCurrency;
  className?: string;
}) {
  if (!budget) {
    return <span className={cn("text-[11px] font-bold text-cf-ink-muted", className)}>{formatMoney(spentCents, currency)} spent</span>;
  }
  const diff = formatMoney(budget.diffCents, currency);
  const limit = formatMoney(budget.budgetCents, currency);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <ProgressBar value={budget.usePct} height={6} fill={budget.over ? "over" : "under"} />
      <span className={cn("text-[11px] font-bold", budget.over ? "text-cf-out-tag" : "text-cf-in-tag")}>
        {budget.over ? BOARD_COPY.budgetOver(diff, limit) : BOARD_COPY.budgetLeft(diff, limit)}
      </span>
      {budget.carryCents !== 0 ? (
        <span className="text-[11px] font-bold text-cf-ink-muted">{carryText(budget.carryCents, currency)}</span>
      ) : null}
    </div>
  );
}
