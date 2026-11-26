"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Error boundary for the AI tab, styled as a card (CLAUDE.md §9). Never shows raw error text. */
export default function AiError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="items-start">
      <h1 className="m-0 font-heading text-[21px] font-semibold">Something went wrong</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        The AI helper couldn&apos;t load. Try again in a moment.
      </p>
      <Button variant="primary" size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </Card>
  );
}
