"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error boundary for a month and its tabs (CLAUDE.md §9). Friendly copy only; the raw
 * error is never shown. `retry` re-renders the segment.
 */
export default function MonthError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <Card role="alert" className="items-start">
      <h1 className="m-0 font-heading text-[21px] font-semibold">Something went wrong</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        We couldn&apos;t show this month right now. Your data is safe, so try again in a moment.
      </p>
      <Button variant="primary" size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </Card>
  );
}
