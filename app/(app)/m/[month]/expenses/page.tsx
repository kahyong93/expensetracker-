import { CategoryBoard } from "@/components/board/category-board";

/**
 * Expenses board (PRD §7.5, B1–B12). The board is shared with Income; its data is loaded
 * on the server by the month layout, so this page only picks the type.
 * Keyed by month so local board state (search, open column, drag target) starts fresh.
 */
export default async function ExpensesPage(props: PageProps<"/m/[month]/expenses">) {
  const { month } = await props.params;
  return <CategoryBoard key={month} type="Out" />;
}
