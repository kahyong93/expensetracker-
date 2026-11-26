import 'server-only';
import { revalidatePath } from 'next/cache';
import { UnauthorisedError } from '@/data/auth';
import type { ActionResult } from '@/lib/types';

export const GENERIC_ERROR = 'Something went wrong, try again';

export const INVALID: ActionResult<never> = { ok: false, code: 'invalid', message: GENERIC_ERROR };

/**
 * Runs a Server Action body: returns its result, revalidates every month page on success
 * so the month layout reloads its data, and turns thrown errors into a friendly result.
 * Only the error name is logged in production: query errors can contain financial data.
 */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const result = await body();
    if (result.ok) revalidatePath('/m/[month]', 'layout');
    return result;
  } catch (error) {
    if (error instanceof UnauthorisedError) {
      return { ok: false, code: 'unauthorised', message: 'Please sign in again' };
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('[action] failed:', error instanceof Error ? error.name : 'unknown error');
    } else {
      console.error('[action] failed:', error);
    }
    return { ok: false, code: 'server_error', message: GENERIC_ERROR };
  }
}

/** For void /data writes. */
export const done: ActionResult = { ok: true, data: undefined };
