"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error boundary for the signed-in app, including the month layout that loads the data
 * (CLAUDE.md §9). It sits outside the app providers, so it uses primitives only.
 * Friendly copy only; the raw error is never shown.
 */
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="mx-auto box-border flex w-full max-w-[1240px] flex-1 flex-col gap-5 bg-cf-paper p-6">
      <Card role="alert" className="items-start">
        <h1 className="m-0 font-heading text-[21px] font-semibold">Something went wrong</h1>
        <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
          We couldn&apos;t load your months right now. Your data is safe, so try again in a moment.
        </p>
        <Button variant="primary" size="lg" onClick={() => retry()}>
          Try again
        </Button>
      </Card>
    </main>
  );
}
