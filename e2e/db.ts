import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { inArray } from 'drizzle-orm';
import { relations } from '../db/relations';
import { users } from '../db/schema';

/**
 * Test-only database access, used to check what the app really stored and to clean up
 * the throwaway test users. App code never does this (docs/data-fetching.md).
 */
export const testDb = drizzle({ client: neon(process.env.DATABASE_URL!), relations });

/** Everything one user owns, shaped for assertions. Amounts are SGD cents. */
export async function snapshot(userId: string) {
  const [user, months, plans] = await Promise.all([
    testDb.query.users.findFirst({ where: { id: userId }, with: { currencyRates: true } }),
    testDb.query.months.findMany({
      where: { userId },
      orderBy: { sortIndex: 'asc' },
      with: { categories: { orderBy: { position: 'asc' }, with: { entries: true } }, aiInsights: true },
    }),
    testDb.query.monthPlans.findMany({ where: { userId }, with: { budgetLines: true } }),
  ]);
  const entries = months.flatMap((m) =>
    m.categories.flatMap((c) =>
      c.entries.map((e) => ({ month: m.key, type: c.type, category: c.name, label: e.label, cents: e.amountCents, note: e.note, id: e.id })),
    ),
  );
  return { user, months, plans, entries };
}

/** Deletes the users' rows; every other table cascades from users. */
export async function deleteUserRows(userIds: string[]) {
  if (userIds.length > 0) await testDb.delete(users).where(inArray(users.id, userIds));
}
