"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMonthKey } from "@/lib/use-month-key";
import { monthHref } from "@/lib/months";
import { cn } from "@/lib/utils";

/**
 * Error boundary for the Expenses board (CLAUDE.md §9, DESIGN_SYSTEM §9 "Error"):
 * friendly copy only, never the raw error text.
 */
export default function ExpensesError({ error, retry }: { error: unknown; retry: () => void }) {
  const { isPhone } = useLayoutMode();
  const monthKey = useMonthKey();

  useEffect(() => {
    // Details stay out of the UI and out of production logs.
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <Card className="items-start" role="alert">
      <h1 className="m-0 font-heading text-[21px] font-semibold">We couldn&apos;t show the expenses board</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        Something went wrong on our side. Try again, or head back to the dashboard.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={() => retry()} className={cn(isPhone && "min-h-11")}>
          Try again
        </Button>
        {monthKey ? (
          <Link
            href={monthHref(monthKey, "dashboard")}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), isPhone && "min-h-11")}
          >
            Go to Dashboard
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
