"use client";

import { useState } from "react";
import { EmptyNote } from "@/components/dashboard/empty-note";
import { RankedRow } from "@/components/dashboard/ranked-row";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { biggestExpenses, merchantRanking } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { MonthData } from "@/lib/types";

/**
 * "Top spending" (PRD D6) with a Merchants / Biggest 10 toggle.
 * Laptop shows 8 merchants / 10 biggest, phone 5 / 5 (DESIGN_SYSTEM §8.2).
 */
type TopMode = "merch" | "big";

const MODE_OPTIONS: readonly SegmentedOption<TopMode>[] = [
  { value: "merch", label: "Merchants" },
  { value: "big", label: "Biggest 10" },
];

const LIMITS = {
  laptop: { merch: 8, big: 10 },
  phone: { merch: 5, big: 5 },
} as const;

type TopSpendingProps = {
  month: MonthData;
  currency: DisplayCurrency;
  isPhone: boolean;
};

export function TopSpending({ month, currency, isPhone }: TopSpendingProps) {
  const [mode, setMode] = useState<TopMode>("merch");
  const limits = isPhone ? LIMITS.phone : LIMITS.laptop;

  const rows =
    mode === "merch"
      ? merchantRanking(month, limits.merch).map((m) => ({
          key: m.label,
          label: m.label,
          meta: `${m.count}× · ${m.category}`,
          amount: formatMoney(m.totalCents, currency),
          barPct: m.barPct,
        }))
      : biggestExpenses(month, limits.big).map(({ entry, barPct }) => ({
          key: entry.id,
          label: entry.label,
          meta: entry.note ? `${entry.category} · ${entry.note}` : entry.category,
          amount: formatMoney(entry.amountCents, currency),
          barPct,
        }));

  return (
    <Card aria-labelledby="dash-top-title" className="gap-3.5">
      <CardHeader>
        <SectionTitle id="dash-top-title">Top spending</SectionTitle>
        <SegmentedControl aria-label="Top spending view" options={MODE_OPTIONS} value={mode} onChange={setMode} size="md" />
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyNote>Your top spending shows up here once {month.key} has expenses.</EmptyNote>
      ) : (
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-x-7 gap-y-1 p-0">
          {rows.map((r, i) => (
            <RankedRow key={r.key} rank={i + 1} label={r.label} meta={r.meta} amount={r.amount} barPct={r.barPct} />
          ))}
        </ol>
      )}
    </Card>
  );
}
