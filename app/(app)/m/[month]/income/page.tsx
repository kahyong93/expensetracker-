import { CategoryBoard } from "@/components/board/category-board";

/**
 * Income board (PRD §7.5, B1–B12). The board is shared with Expenses; its data is loaded
 * on the server by the month layout, so this page only picks the type.
 * Keyed by month so local board state (search, open column, drag target) starts fresh
 * for each month.
 */
export default async function Page(props: PageProps<"/m/[month]/income">) {
  const { month } = await props.params;
  return <CategoryBoard key={month} type="In" />;
}
