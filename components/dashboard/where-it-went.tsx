import { BoardLink } from "@/components/dashboard/board-link";
import { CategoryRow } from "@/components/dashboard/category-row";
import { Donut } from "@/components/dashboard/donut";
import { EmptyNote } from "@/components/dashboard/empty-note";
import { Card, CardHeader, SectionTitle } from "@/components/ui/card";
import { type CategoryStat } from "@/lib/calc";
import { formatMoney, type DisplayCurrency } from "@/lib/money";

/**
 * "Where it went" (PRD D4): expense donut (laptop only) and one row per expense category.
 * Rows and "Expenses board →" open the Expenses tab.
 */
type WhereItWentProps = {
  monthKey: string;
  categories: CategoryStat[];
  donutGradient: string | null;
  spentCents: number;
  currency: DisplayCurrency;
  expensesHref: string;
  isPhone: boolean;
};

export function WhereItWent({
  monthKey,
  categories,
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
