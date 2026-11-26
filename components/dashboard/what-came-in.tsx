import { BoardLink } from "@/components/dashboard/board-link";
import { EmptyNote } from "@/components/dashboard/empty-note";
import { Card, CardHeader, Overline, SectionTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Tag } from "@/components/ui/tag";
import { formatPct, shareDecimals, type CategoryStat } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { Entry } from "@/lib/types";

/**
 * "What came in" (PRD D5): one row per income category (count, total, % share, bar),
 * "Income board →", and on laptop every income line with its category chip.
 */
type WhatCameInProps = {
  monthKey: string;
  categories: CategoryStat[];
  lines: Entry[];
  currency: DisplayCurrency;
  incomeHref: string;
  isPhone: boolean;
};

export function WhatCameIn({ monthKey, categories, lines, currency, incomeHref, isPhone }: WhatCameInProps) {
  return (
    <Card aria-labelledby="dash-in-title" className="gap-3.5">
      <CardHeader>
        <SectionTitle id="dash-in-title">What came in</SectionTitle>
        <BoardLink href={incomeHref} type="In" isPhone={isPhone} />
      </CardHeader>
      {categories.length === 0 ? (
        <EmptyNote>No income categories in {monthKey} yet. Add an item to get started.</EmptyNote>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {categories.map((c) => (
            <li key={c.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2 text-[13px]">
                <span>
                  <span className="font-extrabold">{c.name}</span>{" "}
                  <span className="text-cf-ink-muted">({c.count})</span>
                </span>
                <span>
                  <span className="font-extrabold text-cf-in-tag">{formatMoney(c.totalCents, currency)}</span>{" "}
                  <span className="text-xs text-cf-ink-muted">{formatPct(c.sharePct, shareDecimals("In"))}</span>
                </span>
              </div>
              <ProgressBar value={c.sharePct} height={7} fill="in" track="in" />
            </li>
          ))}
        </ul>
      )}
      {!isPhone && categories.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t-[1.5px] border-dashed border-cf-line pt-2.5">
          <Overline id="dash-in-lines" className="mb-1">
            All income lines
          </Overline>
          {lines.length === 0 ? (
            <EmptyNote>Nothing earned in {monthKey} yet.</EmptyNote>
          ) : (
            <ul aria-labelledby="dash-in-lines" className="m-0 flex list-none flex-col gap-0.5 p-0">
              {lines.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 py-1 text-[13px]">
                  <span className="flex items-center gap-2">
                    <Tag tone="neutral">{e.category}</Tag>
                    {e.label}
                  </span>
                  <span className="font-extrabold">{formatMoney(e.amountCents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}
