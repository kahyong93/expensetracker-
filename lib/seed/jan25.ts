import { toCents } from "@/lib/money";
import { placeEntry } from "@/lib/plan";
import type { Entry, EntryType, MonthData } from "@/lib/types";

/** The Jan-25 sample month, copied from seedMonths() in the reference design. */
export const SAMPLE_MONTH_KEY = "Jan-25";

export const DEFAULT_OUT_CATEGORIES = ["Food", "Transport", "Fixed & Bills", "Shopping & Insurance"];
export const DEFAULT_IN_CATEGORIES = ["Work", "Reimburse", "Interest"];

/** Categories whose items are copied by "Copy recurring items" (PRD G4, Q2). */
export const RECURRING_CATEGORIES = ["Fixed & Bills", "Work", "Interest"];

export function seedJan25(): MonthData {
  let n = 1;
  const it = (type: EntryType, category: string, label: string, amount: number, note = ""): Entry => ({
    id: `tx_${n++}`,
    type,
    category,
    label,
    amountCents: toCents(amount),
    note,
    // Sample expenses are placed by the keyword rules; income has no plan placement.
    ...(type === "Out" ? placeEntry({ label, note, category }) : { sectionId: null, lineId: null }),
  });

  const food = [1, 1.8, 32, 3.4, 2.9, 4, 4, 4.3, 4, 3, 38, 4, 2.9, 4, 4, 2.9, 4.3, 4.3, 3.4, 3.96, 3.96, 3.96, 3.96, 3.96, 3.96];
  const transport = [1.82, 4.51, 4.68, 4.63, 4.63, 5.91, 6.05, 6.05, 5.96, 4.57, 4.54, 3.5, 4.6, 6.05, 4.63, 4.63, 6.05, 4.63, 4.63, 4.83, 4.63, 4.6, 4.16, 0.87, 5.95];

  const entries: Entry[] = [
    ...food.map((a, i) => it("Out", "Food", "Food", a, `Entry #${i + 1}`)),
    ...transport.map((a, i) => it("Out", "Transport", "Transport", a, `Trip #${i + 1}`)),
    it("Out", "Fixed & Bills", "Rental", 800, "Monthly rent"),
    it("Out", "Fixed & Bills", "Parent", 300, "Monthly allowance"),
    it("Out", "Fixed & Bills", "Telcom", 10, "Mobile / telecom"),
    it("Out", "Shopping & Insurance", "De Novo", 6),
    it("Out", "Shopping & Insurance", "Shopee", 24.25, "Order #1"),
    it("Out", "Shopping & Insurance", "Shopee", 133.38, "Order #2"),
    it("Out", "Shopping & Insurance", "YUENYUENG", 13.86),
    it("Out", "Shopping & Insurance", "SHENGSHIONG", 13.14, "Groceries #1"),
    it("Out", "Shopping & Insurance", "Uniqlo", 179.4, "Purchase #1"),
    it("Out", "Shopping & Insurance", "Uniqlo", 117.6, "Purchase #2"),
    it("Out", "Shopping & Insurance", "Uniqlo", 39.9, "Purchase #3"),
    it("Out", "Shopping & Insurance", "Uniqlo", 54.8, "Purchase #4"),
    it("Out", "Shopping & Insurance", "SHENGSHIONG", 15.79, "Groceries #2"),
    it("Out", "Shopping & Insurance", "Uniqlo", 9.9, "Purchase #5"),
    it("Out", "Shopping & Insurance", "Insurance", 279, "Policy #1"),
    it("Out", "Shopping & Insurance", "Insurance", 3299.25, "Policy #2"),
    it("In", "Work", "Work", 5246.18, "Salary"),
    it("In", "Reimburse", "Reimburse", 74.8, "Reimbursement"),
    it("In", "Interest", "Bank-Salary", 39.79),
    it("In", "Interest", "Bank-Saving", 13.26),
    it("In", "Interest", "OCBC-interest", 1.65),
    it("In", "Interest", "DBS-interest", 0.24),
    it("In", "Interest", "CDP", 0),
  ];

  return {
    key: SAMPLE_MONTH_KEY,
    entries,
    outOrder: [...DEFAULT_OUT_CATEGORIES],
    inOrder: [...DEFAULT_IN_CATEGORIES],
    isSample: true,
  };
}

/** Sheet totals shown in the sample audit panel (PRD D7). */
export const SAMPLE_AUDIT = {
  foodSheetCents: 11716,
  interestSheetCents: 1515,
} as const;
