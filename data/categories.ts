import 'server-only';
import { and, eq, inArray, notExists } from 'drizzle-orm';
import { db } from '@/db';
import { categories, entries } from '@/db/schema';
import type { ActionResult, EntryType } from '@/lib/types';
import { requireUserId } from './auth';
import { CATEGORY_NOT_FOUND, MONTH_NOT_FOUND, fail, findOwnedMonth, ok, ownedMonthIds, sameName } from './scope';

/** The categories of one type in one of the user's months, in board order. */
async function boardCategories(userId: string, monthKey: string, type: EntryType) {
  const month = await findOwnedMonth(userId, monthKey);
  if (!month) return null;
  const list = await db.query.categories.findMany({
    where: { monthId: month.id, type, month: { userId } },
    columns: { id: true, name: true, position: true },
    orderBy: { position: 'asc', createdAt: 'asc' },
  });
  return { monthId: month.id, list };
}

/** New column at the end of the board. A duplicate name is ignored (PRD B9). */
export async function addCategory(
  monthKey: string,
  type: EntryType,
  name: string,
): Promise<ActionResult<{ created: boolean }>> {
  const userId = await requireUserId();
  const board = await boardCategories(userId, monthKey, type);
  if (!board) return MONTH_NOT_FOUND;
  if (board.list.some((c) => sameName(c.name, name))) return ok({ created: false });

  const position = board.list.reduce((max, c) => Math.max(max, c.position + 1), 0);
  const inserted = await db
    .insert(categories)
    .values({ monthId: board.monthId, type, name, position })
    .onConflictDoNothing()
    .returning({ id: categories.id });
  return ok({ created: inserted.length > 0 });
}

/** Rename a column; its items follow because they reference the category row (PRD B10). */
export async function renameCategory(
  monthKey: string,
  type: EntryType,
  oldName: string,
  newName: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const board = await boardCategories(userId, monthKey, type);
  if (!board) return MONTH_NOT_FOUND;
  const current = board.list.find((c) => c.name === oldName);
  if (!current) return CATEGORY_NOT_FOUND;
  if (board.list.some((c) => c.id !== current.id && sameName(c.name, newName))) {
    return fail('duplicate', 'That category already exists');
  }

  const renamed = await db
    .update(categories)
    .set({ name: newName })
    .where(and(eq(categories.id, current.id), inArray(categories.monthId, ownedMonthIds(userId))))
    .returning({ id: categories.id });
  return renamed.length > 0 ? ok(undefined) : CATEGORY_NOT_FOUND;
}

/**
 * Delete an empty column only (PRD B11), as one guarded statement so an item added in
 * the meantime can't be lost. When it still has items, fails with code "not_empty" and
 * the PRD toast copy.
 */
export async function deleteCategory(monthKey: string, type: EntryType, name: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const board = await boardCategories(userId, monthKey, type);
  if (!board) return MONTH_NOT_FOUND;
  const target = board.list.find((c) => c.name === name);
  if (!target) return CATEGORY_NOT_FOUND;

  const deleted = await db
    .delete(categories)
    .where(
      and(
        eq(categories.id, target.id),
        inArray(categories.monthId, ownedMonthIds(userId)),
        notExists(db.select({ id: entries.id }).from(entries).where(eq(entries.categoryId, categories.id))),
      ),
    )
    .returning({ id: categories.id });
  if (deleted.length > 0) return ok(undefined);

  const count = await db.$count(entries, eq(entries.categoryId, target.id));
  return fail('not_empty', `Move or delete the ${count} items in "${name}" first`);
}
