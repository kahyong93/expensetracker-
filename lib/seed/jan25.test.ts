import { describe, expect, it } from "vitest";
import { actualsByLine, unassignedCents } from "@/lib/calc";
import { seedJan25 } from "./jan25";

describe("Jan-25 sample month", () => {
  const month = seedJan25();
  const expenses = month.entries.filter((e) => e.type === "Out");
  const where = (label: string) => {
    const e = expenses.find((x) => x.label === label);
    return e && { sectionId: e.sectionId, lineId: e.lineId };
  };

  it("has the 66 expenses and 7 income items of the reference", () => {
    expect(expenses).toHaveLength(66);
    expect(month.entries.filter((e) => e.type === "In")).toHaveLength(7);
  });

  it("places every expense in a section and line, so nothing starts Unassigned", () => {
    expect(expenses.every((e) => e.sectionId && e.lineId)).toBe(true);
    expect(unassignedCents(month)).toBe(0);
  });

  it("places known merchants under the right lines", () => {
    expect(where("Rental")).toEqual({ sectionId: "needs", lineId: "rent" });
    expect(where("Parent")).toEqual({ sectionId: "needs", lineId: "family" });
    expect(where("Telcom")).toEqual({ sectionId: "needs", lineId: "phone" });
    expect(where("SHENGSHIONG")).toEqual({ sectionId: "needs", lineId: "groceries" });
    expect(where("Insurance")).toEqual({ sectionId: "needs", lineId: "insurance" });
    expect(where("Transport")).toEqual({ sectionId: "needs", lineId: "transport" });
    expect(where("Shopee")).toEqual({ sectionId: "fun", lineId: "shopping" });
    expect(where("Uniqlo")).toEqual({ sectionId: "fun", lineId: "shopping" });
  });

  it("keeps income free of sections and lines", () => {
    expect(month.entries.filter((e) => e.type === "In").every((e) => e.sectionId === null && e.lineId === null)).toBe(true);
  });

  it("adds up the groceries line from the food rows and the grocery stores (cents)", () => {
    // 25 "Food" rows + SHENGSHIONG 13.14 + 15.79 + YUENYUENG 13.86
    const food = [1, 1.8, 32, 3.4, 2.9, 4, 4, 4.3, 4, 3, 38, 4, 2.9, 4, 4, 2.9, 4.3, 4.3, 3.4, 3.96, 3.96, 3.96, 3.96, 3.96, 3.96];
    const expected = Math.round(food.reduce((a, b) => a + b, 0) * 100) + 1314 + 1579 + 1386;
    expect(actualsByLine(month).groceries).toBe(expected);
  });
});
