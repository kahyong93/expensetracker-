import { describe, expect, it } from "vitest";
import { applyPatch, isPendingEntry, pendingEntryId } from "@/lib/optimistic";
import type { CashflowData, Entry } from "@/lib/types";

const kopi: Entry = { id: "a", type: "Out", category: "Food", label: "Kopi", amountCents: 120, note: "" };
const bus: Entry = { id: "b", type: "Out", category: "Transport", label: "Bus", amountCents: 200, note: "" };

function data(): CashflowData {
  return {
    monthKey: "Jan-25",
    app: {
      monthKeys: ["Jan-25"],
      currency: "SGD",
      rates: {},
      layout: "auto",
      settings: { autoCategorise: true, compactCards: false, showAudit: true },
    },
    bundle: {
      month: { key: "Jan-25", entries: [kopi, bus], outOrder: ["Food", "Transport"], inOrder: ["Work"], isSample: false },
      budgets: {},
      nextPlan: { budgets: { Food: 5000 }, expectedCents: null, aiNote: "Keep it up" },
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
    applyPatch(original, { kind: "setBudget", category: "Food", cents: null });
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
    const pet: Entry = { id: pendingEntryId(), type: "Out", category: "Pets", label: "Kibble", amountCents: 900, note: "" };
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
    const pay: Entry = { id: "c", type: "In", category: "Bonus", label: "Bonus", amountCents: 1000, note: "" };
    const next = applyPatch(data(), { kind: "saveEntry", entry: pay });
    expect(next.bundle?.month.inOrder).toEqual(["Work", "Bonus"]);
    expect(next.bundle?.month.outOrder).toEqual(["Food", "Transport"]);
  });

  it("sets and removes a budget line", () => {
    const set = applyPatch(data(), { kind: "setBudget", category: "Transport", cents: 3000 });
    expect(set.bundle?.nextPlan.budgets).toEqual({ Food: 5000, Transport: 3000 });
    const removed = applyPatch(data(), { kind: "setBudget", category: "Food", cents: null });
    expect(removed.bundle?.nextPlan.budgets).toEqual({});
  });

  it("replaces budgets, keeping the AI note unless one is given", () => {
    const kept = applyPatch(data(), { kind: "replaceBudgets", budgets: { Transport: 100 } });
    expect(kept.bundle?.nextPlan).toMatchObject({ budgets: { Transport: 100 }, aiNote: "Keep it up" });
    const cleared = applyPatch(data(), { kind: "replaceBudgets", budgets: {}, aiNote: "" });
    expect(cleared.bundle?.nextPlan.aiNote).toBeNull();
    const fresh = applyPatch(data(), { kind: "replaceBudgets", budgets: {}, aiNote: "New" });
    expect(fresh.bundle?.nextPlan.aiNote).toBe("New");
  });

  it("clears budgets and the AI note", () => {
    const next = applyPatch(data(), { kind: "clearBudgets" });
    expect(next.bundle?.nextPlan).toMatchObject({ budgets: {}, aiNote: null });
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
});
