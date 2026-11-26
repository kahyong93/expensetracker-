import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { categories, months, users } from '@/db/schema';
import type { ActionResult } from '@/lib/types';

/*
 * Ownership building blocks shared by the /data helpers. Tables without a user_id column
 * (categories, entries, ai_insights) are scoped by joining up to months.user_id.
 */

/** Subquery: ids of the user's months. Use with inArray(x.monthId, …). */
export function ownedMonthIds(userId: string) {
  return db.select({ id: months.id }).from(months).where(eq(months.userId, userId));
}

/** Subquery: ids of categories in the user's months. Use with inArray(x.categoryId, …). */
export function ownedCategoryIds(userId: string) {
  return db
    .select({ id: categories.id })
    .from(categories)
    .innerJoin(months, eq(categories.monthId, months.id))
    .where(eq(months.userId, userId));
}

/** Insert the user's settings row if it doesn't exist yet (other tables reference it). */
export function ensureUserRow(userId: string) {
  return db.insert(users).values({ id: userId }).onConflictDoNothing();
}

/** The user's month with this key, or undefined. */
export function findOwnedMonth(userId: string, key: string) {
  return db.query.months.findFirst({
    where: { userId, key },
    columns: { id: true, key: true, isSample: true },
  });
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (code: string, message: string): ActionResult<never> => ({ ok: false, code, message });

export const MONTH_NOT_FOUND = fail('month_not_found', "We couldn't find that month");
export const ENTRY_NOT_FOUND = fail('entry_not_found', "We couldn't find that item");
export const CATEGORY_NOT_FOUND = fail('category_not_found', "We couldn't find that category");
