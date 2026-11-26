import { BudgetView } from "@/components/budget/budget-view";

/** Next month budget tab (PRD §7.6). Data is loaded on the server by the month layout. */
export default async function BudgetPage(props: PageProps<"/m/[month]/budget">) {
  const { month } = await props.params;
  return <BudgetView key={month} />;
}
