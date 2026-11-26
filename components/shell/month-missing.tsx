"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCashflowData } from "@/components/providers/cashflow-data-provider";
import { monthHref, type MonthTab } from "@/lib/months";
import { cn } from "@/lib/utils";

/**
 * Shown when the month in the URL doesn't exist (useMonthView() → status "missing").
 * Offers a link to the latest month on the same tab.
 */
export function MonthMissing({ monthKey, tab = "dashboard" }: { monthKey: string; tab?: MonthTab }) {
  const { app } = useCashflowData();
  const latest = app.monthKeys[app.monthKeys.length - 1];
  return (
    <Card className="items-start">
      <h1 className="m-0 font-heading text-[21px] font-semibold">We couldn&apos;t find {monthKey}</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        Pick a month from the header, or create it with + Month.
      </p>
      {latest ? (
        <Link href={monthHref(latest, tab)} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "hover:text-white")}>
          Go to {latest}
        </Link>
      ) : null}
    </Card>
  );
}
