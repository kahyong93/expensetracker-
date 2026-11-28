import { BoardLink } from "@/components/dashboard/board-link";
import { CategoryRow } from "@/components/dashboard/category-row";
import { Donut } from "@/components/dashboard/donut";
import { EmptyNote } from "@/components/dashboard/empty-note";
import { SectionSpend } from "@/components/budget/section-spend";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { type CategoryStat, type SectionSpend as SectionSpendData } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { PLAN } from "@/lib/plan";

/**
 * "Where it went" (PRD D4): expense donut (laptop only) and one row per expense category.
 * Rows and "Expenses board →" open the Expenses tab.
 */
type WhereItWentProps = {
  monthKey: string;
  categories: CategoryStat[];
  /** Spend per section against this month's plan and carry-over. */
  sections: SectionSpendData[];
  donutGradient: string | null;
  spentCents: number;
  currency: DisplayCurrency;
  expensesHref: string;
  isPhone: boolean;
};

export function WhereItWent({
  monthKey,
  categories,
  sections,
  donutGradient,
  spentCents,
  currency,
  expensesHref,
  isPhone,
}: WhereItWentProps) {
  return (
    <Card aria-labelledby="dash-where-title">
      <CardHeader>
        <SectionTitle id="dash-where-title">Where it went</SectionTitle>
        <BoardLink href={expensesHref} type="Out" isPhone={isPhone} />
      </CardHeader>
      {sections.some((s) => s.budget) ? (
        <ul aria-label="Budget by section" className="m-0 flex list-none flex-col gap-3 p-0">
          {sections.map((s) => {
            const sec = PLAN.find((p) => p.id === s.id);
            return sec ? (
              <li key={s.id} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2 text-[13px] font-extrabold" style={{ color: sec.fg }}>
                  {sec.title}
                  <span className="font-heading text-sm font-semibold text-cf-ink">{formatMoney(s.spentCents, currency)}</span>
                </span>
                <SectionSpend spentCents={s.spentCents} budget={s.budget} currency={currency} />
              </li>
            ) : null;
          })}
        </ul>
      ) : null}
      {categories.length === 0 ? (
        <EmptyNote>No expense categories in {monthKey} yet. Add an item to get started.</EmptyNote>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          {!isPhone ? <Donut gradient={donutGradient} totalLabel={formatMoney(spentCents, currency)} /> : null}
          <ul className="m-0 flex min-w-[220px] flex-1 list-none flex-col gap-1.5 p-0">
            {categories.map((c) => (
              <CategoryRow key={c.name} category={c} currency={currency} href={expensesHref} isPhone={isPhone} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
