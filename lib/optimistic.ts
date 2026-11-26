/**
 * Optimistic patches (CLAUDE.md §8): pure functions that apply a pending mutation to the
 * data the server sent, so the UI updates before the Server Action returns. When the
 * action finishes, the fresh server data replaces the patched copy (or the patch is
 * dropped on error, which is the rollback).
 */
import type { CurrencyCode } from "@/lib/money";
import type { CashflowData, Entry, LayoutPref, MonthBundle, MonthData, Settings } from "@/lib/types";

const PENDING_ID_PREFIX = "pending-";

/** Temporary id for an entry shown before the server has saved it. */
export function pendingEntryId(): string {
  return `${PENDING_ID_PREFIX}${crypto.randomUUID()}`;
}

/**
 * True while an entry is only an optimistic placeholder. It has no server id yet, so it
 * can't be edited, moved or deleted until the saved copy arrives.
 */
export function isPendingEntry(entry: Pick<Entry, "id">): boolean {
  return entry.id.startsWith(PENDING_ID_PREFIX);
}

export type CashflowPatch =
  | { kind: "moveEntry"; id: string; category: string }
  | { kind: "deleteEntry"; id: string }
  /** Add (new temporary id) or replace (same id) an entry. */
  | { kind: "saveEntry"; entry: Entry }
  /** Next month's plan (Budget tab). */
  | { kind: "setBudget"; category: string; cents: number | null }
  | { kind: "replaceBudgets"; budgets: Record<string, number>; aiNote?: string }
  | { kind: "clearBudgets" }
  | { kind: "setExpected"; cents: number | null }
  | { kind: "setCurrency"; code: CurrencyCode }
  | { kind: "setRate"; code: CurrencyCode; rate: number }
  | { kind: "setLayout"; layout: LayoutPref }
  | { kind: "setSettings"; settings: Partial<Settings> };

function withCategoryInOrder(month: MonthData, entry: Entry): MonthData {
  const key = entry.type === "Out" ? "outOrder" : "inOrder";
  const order = month[key];
  if (order.some((c) => c.toLowerCase() === entry.category.toLowerCase())) return month;
  return { ...month, [key]: [...order, entry.category] };
}

function patchMonth(bundle: MonthBundle, fn: (month: MonthData) => MonthData): MonthBundle {
  return { ...bundle, month: fn(bundle.month) };
}

function patchBundle(data: CashflowData, fn: (bundle: MonthBundle) => MonthBundle): CashflowData {
  return data.bundle ? { ...data, bundle: fn(data.bundle) } : data;
}

export function applyPatch(data: CashflowData, patch: CashflowPatch): CashflowData {
  switch (patch.kind) {
    case "moveEntry":
      return patchBundle(data, (b) =>
        patchMonth(b, (m) => ({
          ...m,
          entries: m.entries.map((e) => (e.id === patch.id ? { ...e, category: patch.category } : e)),
        })),
      );
    case "deleteEntry":
      return patchBundle(data, (b) =>
        patchMonth(b, (m) => ({ ...m, entries: m.entries.filter((e) => e.id !== patch.id) })),
      );
    case "saveEntry":
      return patchBundle(data, (b) =>
        patchMonth(b, (m) => {
          const exists = m.entries.some((e) => e.id === patch.entry.id);
          const entries = exists
            ? m.entries.map((e) => (e.id === patch.entry.id ? patch.entry : e))
            : [...m.entries, patch.entry];
          return withCategoryInOrder({ ...m, entries }, patch.entry);
        }),
      );
    case "setBudget":
      return patchBundle(data, (b) => {
        const budgets = { ...b.nextPlan.budgets };
        if (patch.cents == null) delete budgets[patch.category];
        else budgets[patch.category] = patch.cents;
        return { ...b, nextPlan: { ...b.nextPlan, budgets } };
      });
    case "replaceBudgets":
      return patchBundle(data, (b) => ({
        ...b,
        nextPlan: {
          ...b.nextPlan,
          budgets: { ...patch.budgets },
          aiNote: patch.aiNote === undefined ? b.nextPlan.aiNote : patch.aiNote || null,
        },
      }));
    case "clearBudgets":
      return patchBundle(data, (b) => ({ ...b, nextPlan: { ...b.nextPlan, budgets: {}, aiNote: null } }));
    case "setExpected":
      return patchBundle(data, (b) => ({ ...b, nextPlan: { ...b.nextPlan, expectedCents: patch.cents } }));
    case "setCurrency":
      return { ...data, app: { ...data.app, currency: patch.code } };
    case "setRate":
      return { ...data, app: { ...data.app, rates: { ...data.app.rates, [patch.code]: patch.rate } } };
    case "setLayout":
      return { ...data, app: { ...data.app, layout: patch.layout } };
    case "setSettings":
      return { ...data, app: { ...data.app, settings: { ...data.app.settings, ...patch.settings } } };
  }
}
