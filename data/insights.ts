import 'server-only';
import { db } from '@/db';
import { aiInsights } from '@/db/schema';
import type { ActionResult, Insight, InsightKind } from '@/lib/types';
import { requireUserId } from './auth';
import { MONTH_NOT_FOUND, findOwnedMonth, ok } from './scope';

/** Cache an AI insight card for one of the user's months (PRD AI-3/5/7). */
export async function saveInsight(monthKey: string, kind: InsightKind, insight: Insight): Promise<ActionResult> {
  const userId = await requireUserId();
  const month = await findOwnedMonth(userId, monthKey);
  if (!month) return MONTH_NOT_FOUND;

  const generatedAt = new Date();
  await db
    .insert(aiInsights)
    .values({ monthId: month.id, kind, payload: insight, generatedAt })
    .onConflictDoUpdate({ target: [aiInsights.monthId, aiInsights.kind], set: { payload: insight, generatedAt } });
  return ok(undefined);
}
