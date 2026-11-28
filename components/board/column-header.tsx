"use client";

import { BOARD_COPY } from "@/components/board/board-copy";
import { carryText } from "@/components/budget/carry-text";
import { CloseIcon, PencilIcon } from "@/components/icons/line-icons";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tag } from "@/components/ui/tag";
import { formatPct, type CategoryStat } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Board column header (PRD B4, DESIGN_SYSTEM §7.6) on the category tint: dot, name,
 * count chip, rename / delete icon buttons, total with a % pill, and the budget bar and
 * line when the category has a budget this month (expenses only; calc returns null otherwise).
 */
export function ColumnHeader({
  stat,
  nameId,
  decimals,
  currency,
  isPhone,
  onRename,
  onRemove,
}: {
  stat: CategoryStat;
  nameId: string;
  decimals: number;
  currency: DisplayCurrency;
  isPhone: boolean;
  /** Income columns can be renamed and removed; the fixed Expenses lines cannot. */
  onRename?: () => void;
  onRemove?: () => void;
}) {
  const { budget } = stat;
  const iconHit = isPhone ? "min-h-11 min-w-11" : undefined;
  return (
    <div className="flex flex-col gap-2 p-3.5" style={{ background: stat.tint }}>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: stat.color }} />
          <h2
            id={nameId}
            className="m-0 min-w-0 truncate font-heading text-base font-semibold"
            title={stat.name}
          >
            {stat.name}
          </h2>
          <Tag tone="white" size="sm">
            {stat.count}
            <span className="sr-only"> items</span>
          </Tag>
        </div>
        {onRename && onRemove ? (
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="icon"
            size="icon"
            className={iconHit}
            title={BOARD_COPY.rename}
            aria-label={`${BOARD_COPY.rename} ${stat.name}`}
            onClick={onRename}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="icon"
            size="icon"
            className={iconHit}
            title={BOARD_COPY.deleteColumn}
            aria-label={`${BOARD_COPY.deleteColumn} ${stat.name}`}
            onClick={onRemove}
          >
            <CloseIcon />
          </Button>
        </div>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="font-heading text-[22px] font-semibold">{formatMoney(stat.totalCents, currency)}</span>
        <Tag tone="plain" size="md" className="bg-cf-surface">
          {formatPct(stat.sharePct, decimals)}
        </Tag>
      </div>
      {budget ? (
        <div className="flex flex-col gap-1">
          <ProgressBar value={budget.usePct} height={6} fill={budget.over ? "over" : "under"} track="white" />
          <span className={cn("text-[11px] font-bold", budget.over ? "text-cf-out-tag" : "text-cf-in-tag")}>
            {budget.over
              ? BOARD_COPY.budgetOver(formatMoney(budget.diffCents, currency), formatMoney(budget.budgetCents, currency))
              : BOARD_COPY.budgetLeft(formatMoney(budget.diffCents, currency), formatMoney(budget.budgetCents, currency))}
          </span>
          {budget.carryCents !== 0 ? (
            <span className="text-[11px] font-bold text-cf-ink-muted">{carryText(budget.carryCents, currency)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
