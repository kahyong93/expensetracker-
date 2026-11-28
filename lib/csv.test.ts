import { describe, expect, it } from "vitest";
import { buildMonthCsv, csvCell, csvFileName } from "@/lib/csv";
import { BASE_CURRENCY, resolveCurrency } from "@/lib/money";
import type { MonthData } from "@/lib/types";

describe("csvCell (CLAUDE.md §9)", () => {
  it("quotes every field and doubles inner quotes", () => {
    expect(csvCell("Kopi")).toBe('"Kopi"');
    expect(csvCell("")).toBe('""');
    expect(csvCell('6" sub, extra')).toBe('"6"" sub, extra"');
  });

  it("neutralises formula injection", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+1")).toBe("\"'+1\"");
    expect(csvCell("-1")).toBe("\"'-1\"");
    expect(csvCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
  });

  it("leaves safe leading characters alone", () => {
    expect(csvCell("1=1")).toBe('"1=1"');
    expect(csvCell(" =x")).toBe('" =x"');
  });
});

describe("buildMonthCsv (PRD X1)", () => {
  const month: MonthData = {
    key: "Jan-25",
    isSample: false,
    outOrder: ["Food"],
    inOrder: ["Work"],
    entries: [
      { id: "1", type: "Out", category: "Food", label: "Kopi", amountCents: 120, note: "=cmd", sectionId: null, lineId: null },
      { id: "2", type: "In", category: "Work", label: "Salary", amountCents: 500000, note: "", sectionId: null, lineId: null },
    ],
  };

  it("names the file after the month", () => {
    expect(csvFileName("Jan-25")).toBe("Jan-25_Cashflow.csv");
  });

  it("writes a header, one row per entry, then next month's budgets by section and line, in plan order", () => {
    const csv = buildMonthCsv(month, resolveCurrency("USD"), {
      key: "Feb-25",
      budgets: { dining: 5000, groceries: 10000, rent: 80000, notaline: 1 },
    });
    expect(csv.split("\r\n")).toEqual([
      '"Month","Type","Category","Item","Amount (SGD)","Amount (USD)","Note"',
      '"Jan-25","Out","Food","Kopi","1.20","0.92","\'=cmd"',
      '"Jan-25","In","Work","Salary","5000.00","3850.00",""',
      '"Feb-25","Budget","Basic Needs","Rent / mortgage","800.00","616.00",""',
      '"Feb-25","Budget","Basic Needs","Groceries","100.00","77.00",""',
      '"Feb-25","Budget","Entertainment","Dining out and food delivery","50.00","38.50",""',
    ]);
  });

  it("has no budget rows when none are set", () => {
    const csv = buildMonthCsv(month, BASE_CURRENCY, { key: "Feb-25", budgets: {} });
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv.split("\r\n")[0]).toContain('"Amount (SGD)","Amount (SGD)"');
  });
});
