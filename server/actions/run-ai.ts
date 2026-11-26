import 'server-only';
import { revalidatePath } from 'next/cache';
import { requireUserId, UnauthorisedError } from '@/data/auth';
import { getAppData } from '@/data/settings';
import { getMonthBundle } from '@/data/months';
import { AiProviderError } from '@/lib/ai/client';
import { aiRateLimiter } from '@/lib/ai/rate-limit';
import { AI_BAD_REPLY_MESSAGE, AI_BUSY_MESSAGE } from '@/lib/ai-messages';
import { resolveCurrency, type DisplayCurrency } from '@/lib/money';
import type { ActionResult, AppData, MonthBundle } from '@/lib/types';
import { GENERIC_ERROR } from './run-action';

export const AI_BUSY: ActionResult<never> = { ok: false, code: 'ai_busy', message: AI_BUSY_MESSAGE };
export const AI_BAD_REPLY: ActionResult<never> = { ok: false, code: 'ai_bad_reply', message: AI_BAD_REPLY_MESSAGE };
export const MONTH_MISSING: ActionResult<never> = { ok: false, code: 'month_not_found', message: "We couldn't find that month" };

/** The signed-in user's month, loaded through /data helpers (docs/data-fetching.md, AI exception). */
export type AiMonth = { app: AppData; bundle: MonthBundle; currency: DisplayCurrency };

export async function loadAiMonth(monthKey: string): Promise<AiMonth | null> {
  const [app, bundle] = await Promise.all([getAppData(), getMonthBundle(monthKey)]);
  if (!bundle) return null;
  return { app, bundle, currency: resolveCurrency(app.currency, app.rates) };
}

/**
 * Runs an AI Server Action body (CLAUDE.md §7): re-checks the session, applies the
 * per-user rate limit, and maps provider failures to "AI is busy…". Only error names are
 * logged in production: prompts and replies contain financial data.
 */
export async function runAi<T>(
  body: () => Promise<ActionResult<T>>,
  { revalidate = false }: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const userId = await requireUserId();
    if (!aiRateLimiter.take(userId)) return AI_BUSY;
    const result = await body();
    if (result.ok && revalidate) revalidatePath('/m/[month]', 'layout');
    return result;
  } catch (error) {
    if (error instanceof UnauthorisedError) {
      return { ok: false, code: 'unauthorised', message: 'Please sign in again' };
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('[ai] failed:', error instanceof Error ? error.name : 'unknown error');
    } else {
      console.error('[ai] failed:', error);
    }
    return error instanceof AiProviderError ? AI_BUSY : { ok: false, code: 'server_error', message: GENERIC_ERROR };
  }
}
