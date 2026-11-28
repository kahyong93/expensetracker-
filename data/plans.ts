import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { budgetLines, monthPlans } from '@/db/schema';
import { getLine } from '@/lib/plan';
import { requireUserId } from './auth';
import { ensureUserRow } from './scope';

/*
 * Month plans: budgets by plan line id (lib/plan.ts), expected income and the AI budget note,
 * keyed by month key so a plan can exist before its month does (PRD P8). Every row carries
 * user_id.
 */

type Batch = [BatchItem<'pg'>, ...BatchItem<'pg'>[]];

/** Make sure the user row and the plan row exist (budget lines reference the plan). */
function ensurePlan(userId: string, monthKey: string): Batch {
  return [ensureUserRow(userId), db.insert(monthPlans).values({ userId, monthKey }).onConflictDoNothing()];
}

function linesOf(userId: string, monthKey: string) {
  return and(eq(budgetLines.userId, userId), eq(budgetLines.monthKey, monthKey));
}

/** Set (cents) or remove (null) one plan line's budget (PRD P2, P9). */
export async function setLineBudget(monthKey: string, lineId: string, cents: number | null): Promise<void> {
  const userId = await requireUserId();
  if (!getLine(lineId)) return;
  if (cents == null) {
    await db.delete(budgetLines).where(and(linesOf(userId, monthKey), eq(budgetLines.lineId, lineId)));
    return;
  }
  await db.batch([
    ...ensurePlan(userId, monthKey),
    db
      .insert(budgetLines)
      .values({ userId, monthKey, lineId, amountCents: cents })
      .onConflictDoUpdate({
        target: [budgetLines.userId, budgetLines.monthKey, budgetLines.lineId],
        set: { amountCents: cents },
      }),
  ]);
}

/**
 * Replace every budget for a month with these plan lines (P5 "Fill with…", AI-4). With `aiNote`
 * (even empty), also stores the AI note; otherwise the note is kept.
 */
export async function replaceLineBudgets(
  monthKey: string,
  budgets: Record<string, number>,
  aiNote?: string,
): Promise<void> {
  const userId = await requireUserId();
  const rows = Object.entries(budgets).flatMap(([lineId, amountCents]) =>
    getLine(lineId) ? [{ userId, monthKey, lineId, amountCents }] : [],
  );
  const batch: Batch = [...ensurePlan(userId, monthKey), db.delete(budgetLines).where(linesOf(userId, monthKey))];
  if (rows.length > 0) batch.push(db.insert(budgetLines).values(rows));
  if (aiNote !== undefined) {
    batch.push(
      db
        .update(monthPlans)
        .set({ aiNote: aiNote || null })
        .where(and(eq(monthPlans.userId, userId), eq(monthPlans.monthKey, monthKey))),
    );
  }
  await db.batch(batch);
}

/** Empty every budget row and the AI note (PRD P7). Expected income is kept. */
export async function clearBudgets(monthKey: string): Promise<void> {
  const userId = await requireUserId();
  await db.batch([
    db.delete(budgetLines).where(linesOf(userId, monthKey)),
    db
      .update(monthPlans)
      .set({ aiNote: null })
      .where(and(eq(monthPlans.userId, userId), eq(monthPlans.monthKey, monthKey))),
  ]);
}

/** Set expected income, or null to go back to the default (PRD P3). */
export async function setExpectedIncome(monthKey: string, cents: number | null): Promise<void> {
  const userId = await requireUserId();
  await db.batch([
    ensureUserRow(userId),
    db
      .insert(monthPlans)
      .values({ userId, monthKey, expectedIncomeCents: cents })
      .onConflictDoUpdate({ target: [monthPlans.userId, monthPlans.monthKey], set: { expectedIncomeCents: cents } }),
  ]);
}
