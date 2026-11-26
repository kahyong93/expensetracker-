"use client";

import { useMemo, useState } from "react";
import {
  applyBudgetDrafts,
  parseAmountInput,
  withoutDraft,
  type BudgetDrafts,
} from "@/components/budget/budget-input";
import { BudgetSummary } from "@/components/budget/budget-summary";
import { PlanTable } from "@/components/budget/plan-table";
import { useMutate } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { useToast } from "@/components/ui/toast";
import { actualsByCategory, categoriesOf, monthTotals, planRows, planTotals } from "@/lib/calc";
import { AI_BUSY_MESSAGE, suggestBudget } from "@/lib/mock/ai";
import type { ActionResult, MonthData, MonthPlan } from "@/lib/types";
import { centsToInput, type DisplayCurrency } from "@/lib/money";
import {
  clearBudgetsAction,
  replaceBudgetsAction,
  setBudgetAction,
  setExpectedIncomeAction,
} from "@/server/actions/plans";

type BudgetPlannerProps = {
  monthKey: string;
  nextKey: string;
  month: MonthData;
  /** Next month's saved plan. */
  plan: MonthPlan;
  currency: DisplayCurrency;
};

/**
 * Next month budget (PRD §7.6 P1–P9, AI-4). Budgets are stored by next month's key, so
 * they work before that month exists (P8). Inputs buffer the raw string and commit on
 * blur or Enter; totals and bars update live from the drafts.
 */
export function BudgetPlanner({ monthKey, nextKey, month, plan, currency }: BudgetPlannerProps) {
  const { isPhone } = useLayoutMode();
  const toast = useToast();
  const mutate = useMutate();
  const [drafts, setDrafts] = useState<BudgetDrafts>({});
  const [expectedDraft, setExpectedDraft] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const storedBudgets = plan.budgets;
  const aiNote = plan.aiNote;

  // Budget writes are optimistic; a failure rolls back to the saved plan with a toast.
  const save = async (pending: Promise<ActionResult>) => {
    const res = await pending;
    if (!res.ok) toast(res.message);
  };

  const categories = useMemo(() => categoriesOf(month, "Out"), [month]);
  const actuals = useMemo(() => actualsByCategory(month), [month]);
  const liveBudgets = useMemo(
    () => applyBudgetDrafts(storedBudgets, drafts, currency),
    [storedBudgets, drafts, currency],
  );
  const rows = useMemo(() => planRows(month, liveBudgets), [month, liveBudgets]);

  // Expected income defaults to this month's income (P3).
  const defaultExpectedCents = useMemo(() => monthTotals(month).earnedCents, [month]);
  const storedExpectedCents = plan.expectedCents ?? defaultExpectedCents;
  const expectedParsed = expectedDraft == null ? null : parseAmountInput(expectedDraft, currency);
  let liveExpectedCents = storedExpectedCents;
  if (expectedParsed?.kind === "cents") liveExpectedCents = expectedParsed.cents;
  else if (expectedParsed?.kind === "clear") liveExpectedCents = defaultExpectedCents;

  const totals = planTotals(categories, liveBudgets, liveExpectedCents);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [name, raw] of Object.entries(drafts)) {
      const parsed = parseAmountInput(raw, currency);
      if (parsed.kind === "invalid") out[name] = parsed.message;
    }
    return out;
  }, [drafts, currency]);

  // P9: an empty input removes that category's budget. Invalid input stays as a draft.
  function commitBudget(category: string) {
    const raw = drafts[category];
    if (raw === undefined) return;
    const parsed = parseAmountInput(raw, currency);
    if (parsed.kind === "invalid") return;
    const cents = parsed.kind === "clear" ? null : parsed.cents;
    if ((storedBudgets[category] ?? null) !== cents) {
      void save(mutate({ kind: "setBudget", category, cents }, () => setBudgetAction(nextKey, category, cents)));
    }
    setDrafts((prev) => withoutDraft(prev, category));
  }

  // P3: an empty input goes back to the default (this month's income).
  function commitExpected() {
    if (expectedDraft == null) return;
    const parsed = parseAmountInput(expectedDraft, currency);
    if (parsed.kind === "invalid") return;
    const cents = parsed.kind === "clear" ? null : parsed.cents;
    if (plan.expectedCents !== cents) {
      void save(mutate({ kind: "setExpected", cents }, () => setExpectedIncomeAction(nextKey, cents)));
    }
    setExpectedDraft(null);
  }

  // P5
  function fill() {
    void save(mutate({ kind: "replaceBudgets", budgets: actuals }, () => replaceBudgetsAction(nextKey, actuals)));
    setDrafts({});
    toast(`Filled with ${monthKey} amounts`);
  }

  // P7
  function clear() {
    void save(mutate({ kind: "clearBudgets" }, () => clearBudgetsAction(nextKey)));
    setDrafts({});
  }

  // P6 / AI-4
  async function suggest() {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const result = await suggestBudget({ actuals, expectedCents: liveExpectedCents, nextKey });
      if (!result.ok) {
        toast(result.message || AI_BUSY_MESSAGE);
        return;
      }
      // Keep exact category names only.
      const budgets: Record<string, number> = {};
      for (const category of categories) {
        const cents = result.data.budgets[category];
        if (typeof cents === "number" && Number.isFinite(cents) && cents >= 0) budgets[category] = Math.round(cents);
      }
      const note = result.data.note;
      const saved = await mutate({ kind: "replaceBudgets", budgets, aiNote: note }, () =>
        replaceBudgetsAction(nextKey, budgets, note),
      );
      if (!saved.ok) {
        toast(saved.message);
        return;
      }
      setDrafts({});
      toast("AI budget filled in. Edit any number.");
    } catch {
      toast(AI_BUSY_MESSAGE);
    } finally {
      setAiBusy(false);
    }
  }

  const nothingToClear =
    Object.keys(storedBudgets).length === 0 && !aiNote && Object.keys(drafts).length === 0;

  return (
    <div className="flex flex-col gap-5">
      <BudgetSummary
        monthKey={monthKey}
        nextKey={nextKey}
        currency={currency}
        isPhone={isPhone}
        aiNote={aiNote}
        aiBusy={aiBusy}
        noCategories={categories.length === 0}
        nothingToClear={nothingToClear}
        expectedValue={expectedDraft ?? centsToInput(storedExpectedCents, currency)}
        expectedError={expectedParsed?.kind === "invalid" ? expectedParsed.message : null}
        totalCents={totals.totalCents}
        leftToSaveCents={totals.leftToSaveCents}
        onFill={fill}
        onSuggest={suggest}
        onClear={clear}
        onExpectedChange={setExpectedDraft}
        onExpectedCommit={commitExpected}
      />
      <PlanTable
        rows={rows}
        monthKey={monthKey}
        nextKey={nextKey}
        currency={currency}
        isPhone={isPhone}
        drafts={drafts}
        errors={errors}
        onDraft={(category, raw) => setDrafts((prev) => ({ ...prev, [category]: raw }))}
        onCommit={commitBudget}
      />
    </div>
  );
}
