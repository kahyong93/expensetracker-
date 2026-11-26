import type { EntryType } from "@/lib/types";

/**
 * User-facing board copy (PRD §7.5 and the reference design), word for word.
 * Kept in one place so the Expenses and Income boards never drift apart.
 */
export const BOARD_COPY = {
  title: (type: EntryType) =>
    type === "Out" ? "Expenses board · drag cards between columns" : "Income board · drag cards between columns",
  searchPlaceholder: "Search items, e.g. Uniqlo",
  searchLabel: "Search items",
  newCategoryButton: "+ Category",
  newCategoryTitle: (type: EntryType) => (type === "Out" ? "New expense category" : "New income category"),
  renameTitle: "Rename category",
  categoryNameLabel: "Category name",
  categoryNamePlaceholder: "e.g. Groceries",
  save: "Save",
  added: (name: string) => `Added "${name}"`,
  renamed: (name: string) => `Renamed to "${name}"`,
  moved: (label: string, category: string) => `Moved "${label}" to ${category}`,
  notEmpty: (count: number, name: string) => `Move or delete the ${count} items in "${name}" first`,
  removeTitle: "Remove empty category?",
  removeText: (name: string) => `Remove the empty "${name}" column?`,
  removeOk: "Remove",
  removed: (name: string) => `Removed "${name}"`,
  deleteItemTitle: "Delete item?",
  deleteItemText: (label: string, amount: string, category: string) => `Delete "${label}" (${amount}) from ${category}?`,
  deleteItemOk: "Delete",
  itemDeleted: "Item deleted",
  moveTo: "Move to…",
  edit: "Edit",
  delete: "Delete",
  addTo: (name: string) => `+ Add to ${name}`,
  dropHere: "Drop items here",
  showItems: (count: number) => `Show ${count} items ▼`,
  hideItems: "Hide items ▲",
  rename: "Rename",
  deleteColumn: "Delete empty category",
  budgetLeft: (left: string, budget: string) => `${left} left of ${budget} budget`,
  budgetOver: (over: string, budget: string) => `${over} over the ${budget} budget`,
  /** Not in the PRD: shown when a board has no categories at all. */
  noCategories: "No categories yet. Add one with + Category.",
  /** Shared generic failure copy (same as the entry modal). */
  error: "Something went wrong, try again",
} as const;
