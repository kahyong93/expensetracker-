import Link from "next/link";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tag } from "@/components/ui/tag";
import { formatPct, shareDecimals, type CategoryStat } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * "Where it went" row (DESIGN_SYSTEM §7.5, PRD D4): dot, name, (count), total and a
 * % pill (laptop only), then a bar. With a budget this month the bar shows budget use
 * and a line reads "S$x left of S$y budget" / "S$x over the S$y budget".
 * The whole row links to the Expenses board.
 */
type CategoryRowProps = {
  category: CategoryStat;
  currency: DisplayCurrency;
  href: string;
  isPhone: boolean;
};

function budgetLine(category: CategoryStat, currency: DisplayCurrency): string | null {
  const b = category.budget;
  if (!b) return null;
  const diff = formatMoney(b.diffCents, currency);
  const limit = formatMoney(b.budgetCents, currency);
  return b.over ? `${diff} over the ${limit} budget` : `${diff} left of ${limit} budget`;
}

export function CategoryRow({ category, currency, href, isPhone }: CategoryRowProps) {
  const line = budgetLine(category, currency);
  const over = category.budget?.over ?? false;
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex flex-col gap-1.5 rounded-cf-inner px-2.5 py-2 text-cf-ink no-underline",
          "transition-[background-color] duration-120 ease-out hover:bg-cf-bg hover:text-cf-ink",
        )}
      >
        <span className="flex items-center justify-between gap-2 text-[13px]">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="size-2.5 flex-none rounded-full" style={{ background: category.color }} />
            <span className="min-w-0 truncate font-extrabold">{category.name}</span>
            <span className="flex-none text-cf-ink-muted">({category.count})</span>
          </span>
          <span className="flex flex-none items-center gap-2">
            <span className="font-extrabold whitespace-nowrap">{formatMoney(category.totalCents, currency)}</span>
            {!isPhone ? (
              <Tag tone="plain" style={{ background: category.tint }}>
                {formatPct(category.sharePct, shareDecimals("Out"))}
              </Tag>
            ) : null}
          </span>
        </span>
        {category.budget ? (
          <ProgressBar value={category.budget.usePct} height={7} fill={over ? "over" : "under"} />
        ) : (
          <ProgressBar value={category.sharePct} height={7} fill={{ color: category.color }} />
        )}
        {line ? (
          <span className={cn("text-[11px] font-bold", over ? "text-cf-out-tag" : "text-cf-in-tag")}>{line}</span>
        ) : null}
      </Link>
    </li>
  );
}
