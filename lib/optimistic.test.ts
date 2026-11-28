import { describe, expect, it } from "vitest";
import { applyPatch, isPendingEntry, pendingEntryId } from "@/lib/optimistic";
import type { CashflowData, Entry } from "@/lib/types";

const kopi: Entry = { id: "a", type: "Out", category: "Food", label: "Kopi", amountCents: 120, note: "", sectionId: null, lineId: null };
const bus: Entry = { id: "b", type: "Out", category: "Transport", label: "Bus", amountCents: 200, note: "", sectionId: null, lineId: null };

function data(): CashflowData {
  return {
    monthKey: "Jan-25",
    app: {
      monthKeys: ["Jan-25"],
      currency: "SGD",
      rates: {},
      layout: "auto",
      settings: { autoCategorise: true, compactCards: false, showAudit: true },
      planPrefs: { split: { needs: 50, invest: 20, fun: 30 }, carryMode: "cum" },
    },
    bundle: {
      month: { key: "Jan-25", entries: [kopi, bus], outOrder: ["Food", "Transport"], inOrder: ["Work"], isSample: false },
      plan: { lines: {}, expectedCents: null, aiNote: null },
      carry: { byLine: {}, sources: [] },
      nextCarry: { byLine: {}, sources: [] },
      nextPlan: { lines: { groceries: 5000 }, expectedCents: null, aiNote: "Keep it up" },
      insights: {},
    },
  };
}

describe("pending entry ids", () => {
  it("marks optimistic placeholders and nothing else", () => {
    const id = pendingEntryId();
    expect(isPendingEntry({ id })).toBe(true);
    expect(isPendingEntry({ id: "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c" })).toBe(false);
    expect(pendingEntryId()).not.toBe(id);
  });
});

describe("applyPatch", () => {
  it("never mutates the server data (so dropping the patch is the rollback)", () => {
    const original = data();
    const snapshot = structuredClone(original);
    applyPatch(original, { kind: "deleteEntry", id: "a" });
    applyPatch(original, { kind: "setLineBudget", lineId: "groceries", cents: null });
    applyPatch(original, { kind: "setSettings", settings: { compactCards: true } });
    expect(original).toEqual(snapshot);
  });

  it("moves an entry to another category", () => {
    const next = applyPatch(data(), { kind: "moveEntry", id: "a", category: "Transport" });
    expect(next.bundle?.month.entries.map((e) => e.category)).toEqual(["Transport", "Transport"]);
  });

  it("deletes an entry", () => {
    const next = applyPatch(data(), { kind: "deleteEntry", id: "a" });
    expect(next.bundle?.month.entries.map((e) => e.id)).toEqual(["b"]);
  });

  it("adds a new entry and its new category column", () => {
    const pet: Entry = { id: pendingEntryId(), type: "Out", category: "Pets", label: "Kibble", amountCents: 900, note: "", sectionId: null, lineId: null };
    const next = applyPatch(data(), { kind: "saveEntry", entry: pet });
    expect(next.bundle?.month.entries).toHaveLength(3);
    expect(next.bundle?.month.outOrder).toEqual(["Food", "Transport", "Pets"]);
  });

  it("replaces an edited entry in place without duplicating a column (case-insensitive)", () => {
    const next = applyPatch(data(), { kind: "saveEntry", entry: { ...kopi, category: "food", amountCents: 150 } });
    expect(next.bundle?.month.entries).toHaveLength(2);
    expect(next.bundle?.month.entries[0].amountCents).toBe(150);
    expect(next.bundle?.month.outOrder).toEqual(["Food", "Transport"]);
  });

  it("adds an income category to the income order", () => {
    const pay: Entry = { id: "c", type: "In", category: "Bonus", label: "Bonus", amountCents: 1000, note: "", sectionId: null, lineId: null };
    const next = applyPatch(data(), { kind: "saveEntry", entry: pay });
    expect(next.bundle?.month.inOrder).toEqual(["Work", "Bonus"]);
    expect(next.bundle?.month.outOrder).toEqual(["Food", "Transport"]);
  });

  it("clears budgets and the AI note", () => {
    const next = applyPatch(data(), { kind: "clearBudgets" });
    expect(next.bundle?.nextPlan).toMatchObject({ lines: {}, aiNote: null });
  });

  it("sets expected income", () => {
    expect(applyPatch(data(), { kind: "setExpected", cents: 500000 }).bundle?.nextPlan.expectedCents).toBe(500000);
  });

  it("updates app-level preferences", () => {
    expect(applyPatch(data(), { kind: "setCurrency", code: "GBP" }).app.currency).toBe("GBP");
    expect(applyPatch(data(), { kind: "setRate", code: "USD", rate: 0.8 }).app.rates).toEqual({ USD: 0.8 });
    expect(applyPatch(data(), { kind: "setLayout", layout: "phone" }).app.layout).toBe("phone");
    expect(applyPatch(data(), { kind: "setSettings", settings: { compactCards: true } }).app.settings).toEqual({
      autoCategorise: true,
      compactCards: true,
      showAudit: true,
    });
  });

  it("leaves data alone when the month doesn't exist", () => {
    const missing: CashflowData = { ...data(), bundle: null };
    expect(applyPatch(missing, { kind: "deleteEntry", id: "a" })).toBe(missing);
  });

  it("sets, replaces and clears budgets by plan line id", () => {
    const set = applyPatch(data(), { kind: "setLineBudget", lineId: "rent", cents: 80000 });
    expect(set.bundle?.nextPlan.lines).toEqual({ groceries: 5000, rent: 80000 });
    const cleared = applyPatch(set, { kind: "setLineBudget", lineId: "groceries", cents: null });
    expect(cleared.bundle?.nextPlan.lines).toEqual({ rent: 80000 });
    const replaced = applyPatch(set, { kind: "replaceLineBudgets", budgets: { util: 1000 } });
    expect(replaced.bundle?.nextPlan.lines).toEqual({ util: 1000 });
    expect(applyPatch(set, { kind: "clearBudgets" }).bundle?.nextPlan.lines).toEqual({});
  });

  it("updates split and carry preferences", () => {
    const prefs = { split: { needs: 40, invest: 30, fun: 30 }, carryMode: "last" as const };
    expect(applyPatch(data(), { kind: "setPlanPrefs", prefs }).app.planPrefs).toEqual(prefs);
  });

  it("moves an expense to a plan line and takes the line's section and name", () => {
    const next = applyPatch(data(), { kind: "moveEntryToLine", id: "a", lineId: "dining" });
    const moved = next.bundle?.month.entries.find((e) => e.id === "a");
    expect(moved).toMatchObject({ category: "Dining out and food delivery", sectionId: "fun", lineId: "dining" });
    expect(next.bundle?.month.outOrder).toContain("Dining out and food delivery");
  });
});
