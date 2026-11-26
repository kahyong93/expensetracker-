'use server';

import * as insightsData from '@/data/insights';
import type { ActionResult, Insight, InsightKind } from '@/lib/types';
import { parseInsight, parseInsightKind, parseMonthLabel } from '@/lib/validation';
import { INVALID, runAction } from './run-action';

/** Cache a generated insight card for the month (PRD AI-3/5/7). */
export async function saveInsightAction(monthKey: string, kind: InsightKind, insight: Insight): Promise<ActionResult> {
  return runAction(async () => {
    const key = parseMonthLabel(monthKey);
    const k = parseInsightKind(kind);
    const value = parseInsight(insight);
    if (!key || !k || !value) return INVALID;
    return insightsData.saveInsight(key, k, value);
  });
}
