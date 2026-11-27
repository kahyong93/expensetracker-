"use client";

import { useId, useState, type CSSProperties } from "react";
import { useMutate } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { AI_BUSY_MESSAGE } from "@/lib/ai-messages";
import type { Insight, InsightKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateInsightAction } from "@/server/actions/ai";

export type InsightCardDef = {
  kind: InsightKind;
  title: string;
  /** Decorative glyph in the 30px badge. */
  icon: string;
  /** Empty-state description for the month. */
  describe: (monthKey: string) => string;
  /** Badge tint + fg (DESIGN_SYSTEM §7.8). */
  badgeClassName: string;
  /** For the one tint that only exists in the category palette. */
  badgeStyle?: CSSProperties;
};

type InsightCardProps = {
  def: InsightCardDef;
  monthKey: string;
  /** Cached result for this month, if any. */
  insight: Insight | undefined;
};

/**
 * AI insight card (PRD AI-3 / AI-5 / AI-7, DESIGN_SYSTEM §7.8). Generate → Refresh, with
 * its own busy flag ("Thinking…"). Results are saved per month in the database.
 */
export function InsightCard({ def, monthKey, insight }: InsightCardProps) {
  const toast = useToast();
  const mutate = useMutate();
  const { isPhone } = useLayoutMode();
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      // Generates and saves on the server, then the month layout re-renders with it.
      const result = await mutate(null, () => generateInsightAction(monthKey, def.kind));
      if (!result.ok) toast(result.message);
    } catch {
      toast(AI_BUSY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy ? "Thinking…" : insight ? "Refresh" : "Generate";

  return (
    <Card padding="ai" gap="sm" className="min-h-[150px]" aria-labelledby={titleId} aria-busy={busy}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-[30px] shrink-0 place-items-center rounded-cf-input-sm text-[15px] font-extrabold",
              def.badgeClassName,
            )}
            style={def.badgeStyle}
          >
            {def.icon}
          </span>
          <h2 id={titleId} className="m-0 font-heading text-lg font-semibold">
            {def.title}
          </h2>
        </span>
        <Button
          variant="soft"
          size="sm"
          onClick={run}
          disabled={busy}
          aria-describedby={titleId}
          className={cn(isPhone && "min-h-11")}
        >
          {buttonLabel}
        </Button>
      </div>

      {insight ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[15px] leading-[1.4] font-extrabold text-pretty">{insight.headline}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {insight.points.map((point, i) => (
              <li
                key={`${i}-${point.title}`}
                className="flex flex-col gap-0.5 rounded-cf-inner bg-cf-bg px-3 py-2.5"
              >
                <span className="text-[13px] font-extrabold">{point.title}</span>
                <span className="text-[13px] leading-[1.45] text-pretty text-cf-ink-soft">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">{def.describe(monthKey)}</p>
      )}
    </Card>
  );
}
