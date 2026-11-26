'use server';

import * as monthsData from '@/data/months';
import type { ActionResult } from '@/lib/types';
import { parseMonthLabel } from '@/lib/validation';
import { INVALID, runAction } from './run-action';

/** "+ Month" (PRD G4). */
export async function createMonthAction(
  label: string,
  copyRecurringFrom: string | null,
): Promise<ActionResult<{ key: string }>> {
  return runAction(async () => {
    const key = parseMonthLabel(label);
    const from = copyRecurringFrom == null ? undefined : parseMonthLabel(copyRecurringFrom);
    if (!key || from === null) return INVALID;
    return monthsData.createMonth(key, { copyRecurringFrom: from });
  });
}

/** First run: "Start fresh" (PRD A3). */
export async function startFreshAction(): Promise<ActionResult<{ key: string }>> {
  return runAction(() => monthsData.startFresh());
}

/** First run "Try with sample data" (PRD A3) and footer "Reset to sample data" (PRD X2). */
export async function loadSampleAction(): Promise<ActionResult<{ key: string }>> {
  return runAction(() => monthsData.loadSampleMonth());
}
