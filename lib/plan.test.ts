import { describe, expect, it } from "vitest";
import {
  CARRY_DEFAULT,
  PLAN,
  PLAN_LINES,
  SPEND_SECS,
  SPLIT_DEFAULT,
  getLine,
  isLineOfSection,
  mapEntry,
  placeEntry,
} from "./plan";

describe("PLAN", () => {
  it("has the three sections in budget-page order", () => {
    expect(PLAN.map((s) => s.title)).toEqual(["Basic Needs", "Investment / Savings", "Entertainment"]);
  });

  it("lists the Basic Needs lines in budget-page order", () => {
    expect(PLAN[0].lines.map((l) => l.name)).toEqual([
      "Rent / mortgage",
      "Utilities",
      "Phone and internet",
      "Transport",
      "Groceries",
      "Insurance",
      "Loan or debt repayments",
      "Family support",
      "Childcare or education fees",
      "Essential subscriptions",
    ]);
  });

  it("has unique line ids", () => {
    const ids = PLAN_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries every section, including investment / savings", () => {
    expect([...SPEND_SECS].sort()).toEqual(["fun", "invest", "needs"]);
  });

  it("defaults split to 50/20/30 and carry to cumulative", () => {
    expect(SPLIT_DEFAULT).toEqual({ needs: 50, invest: 20, fun: 30 });
    expect(CARRY_DEFAULT).toBe("cum");
  });
});

describe("lookups", () => {
  it("finds a line and its section", () => {
    expect(getLine("groceries")?.sectionId).toBe("needs");
    expect(getLine("stocks")?.sectionId).toBe("invest");
    expect(getLine("nope")).toBeUndefined();
  });

  it("checks a line belongs to a section", () => {
    expect(isLineOfSection("needs", "rent")).toBe(true);
    expect(isLineOfSection("fun", "rent")).toBe(false);
  });
});

describe("mapEntry / placeEntry", () => {
  it("maps by label keywords", () => {
    expect(mapEntry({ label: "Rental", note: "Monthly rent" })).toBe("rent");
    expect(mapEntry({ label: "Parent", note: "Monthly allowance" })).toBe("family");
    expect(mapEntry({ label: "SHENGSHIONG" })).toBe("groceries");
    expect(mapEntry({ label: "Netflix" })).toBe("streaming");
  });

  it("falls back to the old category name", () => {
    expect(mapEntry({ label: "Food", category: "Food" })).toBe("groceries");
    expect(mapEntry({ label: "Bus", category: "Transport" })).toBe("transport");
  });

  it("returns null when nothing matches", () => {
    expect(mapEntry({ label: "Mystery", category: "Other" })).toBeNull();
    expect(placeEntry({ label: "Mystery" })).toEqual({ sectionId: null, lineId: null });
  });

  it("places an entry in its section and line", () => {
    expect(placeEntry({ label: "Uniqlo" })).toEqual({ sectionId: "fun", lineId: "shopping" });
  });
});
