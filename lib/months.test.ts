import { describe, expect, it } from "vitest";
import {
  decodeMonthParam,
  isMonthKey,
  monthHref,
  monthKeyOf,
  monthSortIndex,
  nextOf,
  sortMonthKeys,
  tabFromPathname,
} from "@/lib/months";

describe("nextOf (PRD §8 next month key)", () => {
  it("moves to the following month in the same year", () => {
    expect(nextOf("Jan-25")).toBe("Feb-25");
    expect(nextOf("Nov-25")).toBe("Dec-25");
    expect(nextOf("Sep-09")).toBe("Oct-09");
  });

  it("rolls Dec over to Jan of the next year", () => {
    expect(nextOf("Dec-25")).toBe("Jan-26");
    expect(nextOf("Dec-09")).toBe("Jan-10");
    expect(nextOf("Dec-99")).toBe("Jan-00");
  });

  it("accepts any letter case", () => {
    expect(nextOf("jan-25")).toBe("Feb-25");
  });

  it("appends (next) to custom labels", () => {
    expect(nextOf("Holiday")).toBe("Holiday (next)");
    expect(nextOf("Jan-2025")).toBe("Jan-2025 (next)");
  });
});

describe("isMonthKey", () => {
  it("accepts Mon-YY keys only", () => {
    expect(isMonthKey("Jan-25")).toBe(true);
    expect(isMonthKey("dec-99")).toBe(true);
    expect(isMonthKey("Foo-25")).toBe(false);
    expect(isMonthKey("Jan25")).toBe(false);
    expect(isMonthKey("Jan-2025")).toBe(false);
  });
});

describe("monthSortIndex / sortMonthKeys", () => {
  it("returns yyyymm", () => {
    expect(monthSortIndex("Jan-25")).toBe(202501);
    expect(monthSortIndex("Dec-24")).toBe(202412);
  });

  it("sorts custom labels last", () => {
    expect(monthSortIndex("Holiday")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("orders keys chronologically, keeping custom labels in their original order", () => {
    expect(sortMonthKeys(["Mar-25", "Trip", "Dec-24", "Jan-25", "Holiday"])).toEqual([
      "Dec-24",
      "Jan-25",
      "Mar-25",
      "Trip",
      "Holiday",
    ]);
  });

  it("does not mutate its input", () => {
    const keys = ["Feb-25", "Jan-25"];
    sortMonthKeys(keys);
    expect(keys).toEqual(["Feb-25", "Jan-25"]);
  });
});

describe("monthKeyOf", () => {
  it("formats a date as Mon-YY", () => {
    expect(monthKeyOf(new Date(2026, 10, 24))).toBe("Nov-26");
    expect(monthKeyOf(new Date(2000, 0, 1))).toBe("Jan-00");
  });
});

describe("month URLs", () => {
  it("builds tab hrefs", () => {
    expect(monthHref("Jan-25")).toBe("/m/Jan-25");
    expect(monthHref("Jan-25", "dashboard")).toBe("/m/Jan-25");
    expect(monthHref("Jan-25", "budget")).toBe("/m/Jan-25/budget");
  });

  it("encodes custom labels and decodes them back", () => {
    const href = monthHref("Bills & Fun");
    expect(href).toBe("/m/Bills%20%26%20Fun");
    expect(decodeMonthParam(href.split("/")[2])).toBe("Bills & Fun");
  });

  it("returns malformed params unchanged", () => {
    expect(decodeMonthParam("100%")).toBe("100%");
  });

  it("reads the tab from a pathname", () => {
    expect(tabFromPathname("/m/Jan-25/expenses")).toBe("expenses");
    expect(tabFromPathname("/m/Jan-25/ai")).toBe("ai");
    expect(tabFromPathname("/m/Jan-25")).toBe("dashboard");
    expect(tabFromPathname("/m/Jan-25/unknown")).toBe("dashboard");
  });
});
