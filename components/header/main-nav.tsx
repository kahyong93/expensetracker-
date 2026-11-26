"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { monthTotals } from "@/lib/calc";
import { monthHref, tabFromPathname, type MonthTab } from "@/lib/months";
import { cn } from "@/lib/utils";

/** Main nav (PRD G2, DESIGN_SYSTEM §7.2 / §8.2). Tabs are links; the URL holds the tab. */
const TABS: ReadonlyArray<{ tab: MonthTab; label: string; short: string }> = [
  { tab: "dashboard", label: "Dashboard", short: "Home" },
  { tab: "expenses", label: "Expenses", short: "Spent" },
  { tab: "income", label: "Income", short: "Earned" },
  { tab: "budget", label: "Next month budget", short: "Budget" },
  { tab: "ai", label: "✦ AI helper", short: "AI" },
];

export function MainNav() {
  const { isPhone } = useLayoutMode();
  const pathname = usePathname();
  const view = useMonthView();
  const { monthKey } = view;
  const active = tabFromPathname(pathname);
  const totals = view.status === "ready" ? monthTotals(view.month) : null;
  const badges: Partial<Record<MonthTab, number>> = totals
    ? { expenses: totals.outCount, income: totals.inCount }
    : {};

  if (!monthKey) return null;

  return (
    <nav
      aria-label="Main"
      className={cn(
        "box-border max-w-full gap-1 rounded-cf-pill bg-cf-track p-1",
        isPhone ? "order-3 grid w-full grid-cols-5" : "flex flex-wrap",
      )}
    >
      {TABS.map(({ tab, label, short }) => {
        const current = tab === active;
        const badge = badges[tab];
        return (
          <Link
            key={tab}
            href={monthHref(monthKey, tab)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-none items-center justify-center gap-1.5 rounded-cf-pill text-[13px] font-extrabold whitespace-nowrap no-underline",
              "transition-[background-color,color] duration-120 ease-out",
              isPhone ? "px-1 py-[9px]" : "px-3.5 py-2",
              current
                ? "bg-cf-surface text-cf-primary shadow-cf-tab hover:text-cf-primary"
                : "text-cf-ink-muted hover:text-cf-ink",
            )}
          >
            {isPhone ? short : label}
            {!isPhone && badge != null ? (
              <span className="rounded-cf-pill bg-cf-surface px-[7px] py-px text-[11px] text-cf-ink-muted">{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
