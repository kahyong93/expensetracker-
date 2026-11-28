import { describe, expect, it } from "vitest";
import { carryInto, NO_CARRY, type MonthSnapshot } from "./carry";

const snap = (key: string, budgets: Record<string, number>, actuals: Record<string, number> = {}): MonthSnapshot => ({
  key,
  budgets,
  actuals,
});

describe("carryInto", () => {
  const history = [
    snap("Jan-25", { groceries: 50000, stocks: 20000 }, { groceries: 40000, stocks: 5000 }),
    snap("Feb-25", { groceries: 50000 }, { groceries: 55000 }),
  ];

  it("carries nothing when off", () => {
    expect(carryInto("Mar-25", "off", history)).toEqual(NO_CARRY);
  });

  it("adds up unused budget over the year when cumulative, and overspending counts against it", () => {
    const info = carryInto("Mar-25", "cum", history);
    expect(info.sources).toEqual(["Jan-25", "Feb-25"]);
    expect(info.byLine).toEqual({ groceries: 10000 - 5000, stocks: 15000 });
  });

  it("carries only the previous month when 'last'", () => {
    const info = carryInto("Mar-25", "last", history);
    expect(info.sources).toEqual(["Feb-25"]);
    expect(info.byLine).toEqual({ groceries: -5000 });
  });

  it("resets each January (cumulative never crosses a year)", () => {
    const info = carryInto("Jan-26", "cum", history);
    expect(info).toEqual(NO_CARRY);
  });

  it("still carries across Dec to Jan when 'last'", () => {
    const dec = [snap("Dec-25", { rent: 100000 }, { rent: 90000 })];
    expect(carryInto("Jan-26", "last", dec).byLine).toEqual({ rent: 10000 });
  });

  it("ignores later months, the month itself, empty plans, unknown lines and custom labels", () => {
    const odd = [
      snap("Mar-25", { rent: 100 }),
      snap("Apr-25", { rent: 100 }),
      snap("Jan-25", {}, { rent: 5 }),
      snap("Feb-25", { notaline: 100 }),
      snap("Trip", { rent: 100 }),
    ];
    const info = carryInto("Mar-25", "cum", odd);
    expect(info.byLine).toEqual({});
    expect(carryInto("Trip", "cum", odd)).toEqual(NO_CARRY);
  });

  it("carries investment / savings too", () => {
    const info = carryInto("Feb-25", "cum", [snap("Jan-25", { emergency: 30000 }, { emergency: 10000 })]);
    expect(info.byLine).toEqual({ emergency: 20000 });
  });
});
