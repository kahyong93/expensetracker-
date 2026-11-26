"use client";

import { createContext, startTransition, useCallback, useContext, useMemo, useOptimistic, type ReactNode } from "react";
import { resolveCurrency, type DisplayCurrency } from "@/lib/money";
import { nextOf } from "@/lib/months";
import { applyPatch, type CashflowPatch } from "@/lib/optimistic";
import type { ActionResult, CashflowData, Insight, InsightKind, MonthData, MonthPlan, Settings } from "@/lib/types";

/**
 * Hands the data the month layout (a Server Component) loaded to the client tree. It
 * never fetches: fresh data arrives as new props when a Server Action revalidates
 * (docs/data-fetching.md). `mutate` runs an action with an optional optimistic patch.
 */
export type Mutate = <T>(
  patch: CashflowPatch | null,
  action: () => Promise<ActionResult<T>>,
) => Promise<ActionResult<T>>;

type CashflowContextValue = { data: CashflowData; mutate: Mutate };

const CashflowContext = createContext<CashflowContextValue | null>(null);

const NETWORK_ERROR: ActionResult<never> = {
  ok: false,
  code: "network",
  message: "Something went wrong, try again",
};

export function CashflowDataProvider({ data, children }: { data: CashflowData; children: ReactNode }) {
  const [optimistic, addPatch] = useOptimistic(data, applyPatch);

  const mutate = useCallback<Mutate>(
    (patch, action) =>
      new Promise((resolve) => {
        startTransition(async () => {
          if (patch) addPatch(patch);
          try {
            resolve(await action());
          } catch {
            resolve(NETWORK_ERROR);
          }
        });
      }),
    [addPatch],
  );

  const value = useMemo(() => ({ data: optimistic, mutate }), [optimistic, mutate]);
  return <CashflowContext.Provider value={value}>{children}</CashflowContext.Provider>;
}

function useCashflowContext(): CashflowContextValue {
  const ctx = useContext(CashflowContext);
  if (!ctx) throw new Error("Cashflow hooks must be used inside <CashflowDataProvider>");
  return ctx;
}

/** Settings, month list and the URL's month data (with pending optimistic patches). */
export function useCashflowData(): CashflowData {
  return useCashflowContext().data;
}

/** Run a Server Action, optionally applying an optimistic patch until it returns. */
export function useMutate(): Mutate {
  return useCashflowContext().mutate;
}

/** The display currency with the user's rate overrides. */
export function useDisplayCurrency(): DisplayCurrency {
  const { app } = useCashflowData();
  return resolveCurrency(app.currency, app.rates);
}

export type MonthView =
  | { status: "missing"; monthKey: string }
  | {
      status: "ready";
      monthKey: string;
      nextKey: string;
      month: MonthData;
      currency: DisplayCurrency;
      /** Budgets set for this month (SGD cents by category). */
      budgets: Record<string, number>;
      /** Next month's budgets, expected income and AI note. */
      nextPlan: MonthPlan;
      insights: Partial<Record<InsightKind, Insight>>;
      settings: Settings;
    };

/** Everything a page needs for the month in the URL, or "missing" when there's no such month. */
export function useMonthView(): MonthView {
  const { app, monthKey, bundle } = useCashflowData();
  if (!bundle) return { status: "missing", monthKey };
  return {
    status: "ready",
    monthKey,
    nextKey: nextOf(monthKey),
    month: bundle.month,
    currency: resolveCurrency(app.currency, app.rates),
    budgets: bundle.budgets,
    nextPlan: bundle.nextPlan,
    insights: bundle.insights,
    settings: app.settings,
  };
}
