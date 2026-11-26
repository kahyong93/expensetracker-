"use client";

import { InsightCard, type InsightCardDef } from "@/components/ai/insight-card";
import { CATEGORY_PALETTE } from "@/lib/design/palette";
import type { Insight, InsightKind } from "@/lib/types";

/** Card copy and badge colours from the reference design (DESIGN_SYSTEM §7.8). */
const INSIGHT_CARDS: readonly InsightCardDef[] = [
  {
    kind: "summary",
    title: "Monthly summary",
    icon: "✦",
    describe: (monthKey) => `A friendly recap of ${monthKey}: what drove spending and how much you kept.`,
    badgeClassName: "bg-cf-soft-note text-cf-primary",
  },
  {
    kind: "alerts",
    title: "Spending alerts",
    icon: "!",
    describe: () => "Spots one-off spikes and small spends that quietly add up.",
    badgeClassName: "bg-cf-bal-tint text-cf-bal-tag",
  },
  {
    kind: "tips",
    title: "Savings tips",
    icon: "↓",
    describe: () => "Ideas to cut back, based on your top merchants and categories.",
    badgeClassName: "text-cf-in-tag",
    // #E5F7EF has no --cf-* token; it is palette tint index 4.
    badgeStyle: { background: CATEGORY_PALETTE[4].tint },
  },
];

type InsightCardsProps = {
  monthKey: string;
  insights: Partial<Record<InsightKind, Insight>>;
};

/** The three AI insight cards, in an auto-fit grid (min 300px per card). */
export function InsightCards({ monthKey, insights }: InsightCardsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-4">
      {INSIGHT_CARDS.map((def) => (
        <InsightCard key={def.kind} def={def} monthKey={monthKey} insight={insights[def.kind]} />
      ))}
    </div>
  );
}
