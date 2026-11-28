import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { categories, entries } from '@/db/schema';
import { getLine, PLAN_LINES } from '@/lib/plan';
import type { ActionResult, EntryInput, EntryType } from '@/lib/types';
import { requireUserId } from './auth';
import { ENTRY_NOT_FOUND, CATEGORY_NOT_FOUND, MONTH_NOT_FOUND, findOwnedMonth, ok, ownedCategoryIds, sameName } from './scope';

type CategoryRef = { id: string; type: EntryType; name: string };

/**
 * Category ids for (type, name) pairs in one of the user's months, creating any that
 * don't exist yet at the end of their board. Names match case-insensitively (PRD B9).
 * The month must belong to `userId`; every query re-checks that.
 */
async function resolveCategories(
  userId: string,
  monthId: string,
  wanted: readonly { type: EntryType; name: string }[],
): Promise<(type: EntryType, name: string) => CategoryRef | undefined> {
  const load = () =>
    db.query.categories.findMany({
      where: { monthId, month: { userId } },
      columns: { id: true, type: true, name: true, position: true },
    });

  let existing = await load();
  const find = (type: EntryType, name: string) => existing.find((c) => c.type === type && sameName(c.name, name));

  const missing: { monthId: string; type: EntryType; name: string; position: number }[] = [];
  const nextPosition = { Out: 0, In: 0 };
  for (const c of existing) nextPosition[c.type] = Math.max(nextPosition[c.type], c.position + 1);
  for (const w of wanted) {
    if (find(w.type, w.name) || missing.some((m) => m.type === w.type && sameName(m.name, w.name))) continue;
    missing.push({ monthId, type: w.type, name: w.name, position: nextPosition[w.type]++ });
  }

  if (missing.length > 0) {
    // A concurrent request may have created the same column: keep theirs.
    await db.insert(categories).values(missing).onConflictDoNothing();
    existing = await load();
  }
  return find;
}

/** Add entries to one of the user's months (PRD E1–E5, AI-6 after the user confirms). */
export async function addEntries(monthKey: string, inputs: readonly EntryInput[]): Promise<ActionResult<number>> {
  const userId = await requireUserId();
  const month = await findOwnedMonth(userId, monthKey);
  if (!month) return MONTH_NOT_FOUND;

  const find = await resolveCategories(
    userId,
    month.id,
    inputs.map((i) => ({ type: i.type, name: i.category })),
  );

  const base = Date.now();
  const rows = inputs.flatMap((input, i) => {
    const category = find(input.type, input.category);
    return category
      ? [{
          categoryId: category.id,
          label: input.label,
          amountCents: input.amountCents,
          note: input.note || null,
          sectionId: input.sectionId,
          lineId: input.lineId,
          createdAt: new Date(base + i),
        }]
      : [];
  });
  if (rows.length !== inputs.length) return CATEGORY_NOT_FOUND;

  await db.insert(entries).values(rows);
  return ok(rows.length);
}

/** Id of the plan line whose name matches (case-insensitive), or undefined. */
function lineIdByName(name: string): string | undefined {
  return PLAN_LINES.find((l) => sameName(l.name, name))?.id;
}

/** The user's entry with its category, or undefined. */
function findOwnedEntry(userId: string, entryId: string) {
  return db.query.entries.findFirst({
    where: { id: entryId, category: { month: { userId } } },
    columns: { id: true, categoryId: true },
    with: { category: { columns: { monthId: true, type: true, name: true } } },
  });
}

/** Edit an entry (PRD E1–E5). A new category is created in the entry's month if needed. */
export async function updateEntry(entryId: string, input: EntryInput): Promise<ActionResult> {
  const userId = await requireUserId();
  const entry = await findOwnedEntry(userId, entryId);
  if (!entry) return ENTRY_NOT_FOUND;

  const find = await resolveCategories(userId, entry.category.monthId, [{ type: input.type, name: input.category }]);
  const target = find(input.type, input.category);
  if (!target) return CATEGORY_NOT_FOUND;

  const updated = await db
    .update(entries)
    .set({
      categoryId: target.id,
      label: input.label,
      amountCents: input.amountCents,
      note: input.note || null,
      sectionId: input.sectionId,
      lineId: input.lineId,
    })
    .where(and(eq(entries.id, entryId), inArray(entries.categoryId, ownedCategoryIds(userId))))
    .returning({ id: entries.id });
  return updated.length > 0 ? ok(undefined) : ENTRY_NOT_FOUND;
}

/** Delete one of the user's entries (PRD B7). */
export async function deleteEntry(entryId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const deleted = await db
    .delete(entries)
    .where(and(eq(entries.id, entryId), inArray(entries.categoryId, ownedCategoryIds(userId))))
    .returning({ id: entries.id });
  return deleted.length > 0 ? ok(undefined) : ENTRY_NOT_FOUND;
}

/**
 * Move an expense to a plan line (Expenses board drag and drop, "Move to…"). The entry takes
 * the line's section and line ids and moves to the month's column named like the line,
 * created if needed.
 */
export async function moveEntryToLine(entryId: string, lineId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const line = getLine(lineId);
  if (!line) return CATEGORY_NOT_FOUND;
  const entry = await findOwnedEntry(userId, entryId);
  if (!entry || entry.category.type !== 'Out') return ENTRY_NOT_FOUND;

  const find = await resolveCategories(userId, entry.category.monthId, [{ type: 'Out', name: line.name }]);
  const target = find('Out', line.name);
  if (!target) return CATEGORY_NOT_FOUND;

  const moved = await db
    .update(entries)
    .set({ categoryId: target.id, sectionId: line.sectionId, lineId: line.id })
    .where(and(eq(entries.id, entryId), inArray(entries.categoryId, ownedCategoryIds(userId))))
    .returning({ id: entries.id });
  return moved.length > 0 ? ok(undefined) : ENTRY_NOT_FOUND;
}

/**
 * Move an entry to another existing category of the same month and type (PRD B5/B6:
 * drag and drop, "Move to…").
 */
export async function moveEntry(entryId: string, categoryName: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const entry = await findOwnedEntry(userId, entryId);
  if (!entry) return ENTRY_NOT_FOUND;

  const siblings = await db.query.categories.findMany({
    where: { monthId: entry.category.monthId, type: entry.category.type, month: { userId } },
    columns: { id: true, name: true },
  });
  const target = siblings.find((c) => c.name === categoryName) ?? siblings.find((c) => sameName(c.name, categoryName));
  if (!target) return CATEGORY_NOT_FOUND;
  if (target.id === entry.categoryId) return ok(undefined);
  const line = entry.category.type === 'Out' ? getLine(lineIdByName(target.name)) : undefined;

  const moved = await db
    .update(entries)
    // An expense moved to a column named like a plan line takes that line (and its section).
    .set({ categoryId: target.id, ...(line ? { sectionId: line.sectionId, lineId: line.id } : {}) })
    .where(and(eq(entries.id, entryId), inArray(entries.categoryId, ownedCategoryIds(userId))))
    .returning({ id: entries.id });
  return moved.length > 0 ? ok(undefined) : ENTRY_NOT_FOUND;
}
