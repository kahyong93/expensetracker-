"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Budget tab error boundary. Never shows raw error text (CLAUDE.md §9). */
export default function BudgetError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="items-start">
      <h1 className="m-0 font-heading text-[21px] font-semibold">Something went wrong</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">We couldn&apos;t load your budget. Try again.</p>
      <Button variant="primary" size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </Card>
  );
}
