import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_PREFS } from "./plan";

describe("DEFAULT_PLAN_PREFS", () => {
  it("is split 50/20/30 with cumulative carry-over (what Reset restores)", () => {
    expect(DEFAULT_PLAN_PREFS).toEqual({ split: { needs: 50, invest: 20, fun: 30 }, carryMode: "cum" });
  });
});
