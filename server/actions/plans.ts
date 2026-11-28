'use server';

import * as plansData from '@/data/plans';
import * as settingsData from '@/data/settings';
import type { ActionResult, PlanPrefs } from '@/lib/types';
import {
  parseCents,
  parseLineBudgets,
  parseLineId,
  parsePlanKey,
  parsePlanPrefs,
} from '@/lib/validation';
import { INVALID, done, runAction } from './run-action';

/*
 * Next-month plan mutations (PRD §7.6). Plans are keyed by month key and may exist before
 * that month does (P8), so the key is not checked against the user's months.
 */

/** Set or clear one plan line's budget, by line id (PRD P2, P9). */
export async function setLineBudgetAction(monthKey: string, lineId: string, cents: number | null): Promise<ActionResult> {
  return runAction(async () => {
    const key = parsePlanKey(monthKey);
    const line = parseLineId(lineId);
    const amount = cents == null ? null : parseCents(cents);
    if (!key || !line || (cents != null && amount == null)) return INVALID;
    await plansData.setLineBudget(key, line, amount);
    return done;
  });
}

/** P5 "Fill with…": every line's budget at once, by line id. */
export async function replaceLineBudgetsAction(monthKey: string, budgets: Record<string, number>): Promise<ActionResult> {
  return runAction(async () => {
    const key = parsePlanKey(monthKey);
    const parsed = parseLineBudgets(budgets);
    if (!key || !parsed) return INVALID;
    await plansData.replaceLineBudgets(key, parsed);
    return done;
  });
}

/** Split targets and carry mode (shared by every month). */
export async function setPlanPrefsAction(prefs: PlanPrefs): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = parsePlanPrefs(prefs);
    if (!parsed) return INVALID;
    await settingsData.updatePlanPrefs(parsed);
    return done;
  });
}

export async function clearBudgetsAction(monthKey: string): Promise<ActionResult> {
  return runAction(async () => {
    const key = parsePlanKey(monthKey);
    if (!key) return INVALID;
    await plansData.clearBudgets(key);
    return done;
  });
}

export async function setExpectedIncomeAction(monthKey: string, cents: number | null): Promise<ActionResult> {
  return runAction(async () => {
    const key = parsePlanKey(monthKey);
    const amount = cents == null ? null : parseCents(cents);
    if (!key || (cents != null && amount == null)) return INVALID;
    await plansData.setExpectedIncome(key, amount);
    return done;
  });
}
