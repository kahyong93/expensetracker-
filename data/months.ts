import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { aiInsights, categories, entries, months } from '@/db/schema';
import { placeEntry } from '@/lib/plan';
import { isMonthKey, monthKeyOf, monthSortIndex, nextOf } from '@/lib/months';
import {
  DEFAULT_IN_CATEGORIES,
  DEFAULT_OUT_CATEGORIES,
  RECURRING_CATEGORIES,
  SAMPLE_MONTH_KEY,
  seedJan25,
} from '@/lib/seed/jan25';
import type { ActionResult, Entry, EntryInput, Insight, InsightKind, MonthBundle, MonthPlan } from '@/lib/types';
import { parseInsight } from '@/lib/validation';
import { requireUserId } from './auth';
import { ensureUserRow, fail, findOwnedMonth, ok, ownedMonthIds, sameName } from './scope';

/** months.sort_index for custom labels (yyyymm keys are always smaller). */
const CUSTOM_SORT_INDEX = 999_999;

const MONTH_EXISTS = fail('exists', 'That month already exists');

type Batch = [BatchItem<'pg'>, ...BatchItem<'pg'>[]];

// ---------------------------------------------------------------------------
// Reads

/** The user's latest month key (chronological, custom labels last), or null. */
export async function getLatestMonthKey(): Promise<string | null> {
  const userId = await requireUserId();
  const latest = await db.query.months.findFirst({
    where: { userId },
    columns: { key: true },
    orderBy: { sortIndex: 'desc', createdAt: 'desc' },
  });
  return latest?.key ?? null;
}

function toPlan(
  row: { expectedIncomeCents: number | null; aiNote: string | null; budgetLines: { categoryName: string; amountCents: number }[] } | undefined,
): MonthPlan {
  const budgets: Record<string, number> = {};
  for (const line of row?.budgetLines ?? []) budgets[line.categoryName] = line.amountCents;
  return { budgets, expectedCents: row?.expectedIncomeCents ?? null, aiNote: row?.aiNote || null };
}

/**
 * The user's month with this key: categories in saved order, entries in the order they
 * were added, this month's budgets, next month's plan and cached AI insights.
 * Returns null when the user has no such month.
 */
export async function getMonthBundle(key: string): Promise<MonthBundle | null> {
  const userId = await requireUserId();
  const nextKey = nextOf(key);

  const [month, plans] = await Promise.all([
    db.query.months.findFirst({
      where: { userId, key },
      columns: { key: true, isSample: true },
      with: {
        categories: {
          columns: { type: true, name: true },
          orderBy: { position: 'asc', createdAt: 'asc' },
          with: {
            entries: {
              columns: { id: true, label: true, amountCents: true, note: true, sectionId: true, lineId: true, createdAt: true },
              orderBy: { createdAt: 'asc', id: 'asc' },
            },
          },
        },
        aiInsights: { columns: { kind: true, payload: true } },
      },
    }),
    db.query.monthPlans.findMany({
      where: { userId, monthKey: { in: [key, nextKey] } },
      columns: { monthKey: true, expectedIncomeCents: true, aiNote: true },
      with: { budgetLines: { columns: { categoryName: true, amountCents: true } } },
    }),
  ]);

  if (!month) return null;

  // Entries in the order they were added, across all categories.
  const rows: { entry: Entry; addedAt: number }[] = [];
  for (const c of month.categories) {
    for (const e of c.entries) {
      rows.push({
        entry: {
          id: e.id,
          type: c.type,
          category: c.name,
          label: e.label,
          amountCents: e.amountCents,
          note: e.note ?? '',
          // Expenses saved before sections existed are placed by the keyword rules (S3);
          // the guess is saved the first time the entry is edited.
          ...(c.type === 'Out' && !e.lineId
            ? placeEntry({ label: e.label, note: e.note ?? '', category: c.name })
            : { sectionId: e.sectionId, lineId: e.lineId }),
        },
        addedAt: e.createdAt.getTime(),
      });
    }
  }
  rows.sort((a, b) => a.addedAt - b.addedAt || a.entry.id.localeCompare(b.entry.id));

  const insights: Partial<Record<InsightKind, Insight>> = {};
  for (const row of month.aiInsights) {
    const insight = parseInsight(row.payload);
    if (insight) insights[row.kind] = insight;
  }

  return {
    month: {
      key: month.key,
      isSample: month.isSample,
      outOrder: month.categories.filter((c) => c.type === 'Out').map((c) => c.name),
      inOrder: month.categories.filter((c) => c.type === 'In').map((c) => c.name),
      entries: rows.map((r) => r.entry),
    },
    budgets: toPlan(plans.find((p) => p.monthKey === key)).budgets,
    nextPlan: toPlan(plans.find((p) => p.monthKey === nextKey)),
    insights,
  };
}

// ---------------------------------------------------------------------------
// Writes

type MonthContents = {
  outOrder: readonly string[];
  inOrder: readonly string[];
  entries: readonly EntryInput[];
};

/** Insert statements for a month's categories and entries (ids generated up front). */
function contentInserts(monthId: string, contents: MonthContents): BatchItem<'pg'>[] {
  const categoryRows = [
    ...contents.outOrder.map((name, position) => ({ id: crypto.randomUUID(), monthId, type: 'Out' as const, name, position })),
    ...contents.inOrder.map((name, position) => ({ id: crypto.randomUUID(), monthId, type: 'In' as const, name, position })),
  ];
  const categoryId = (type: EntryInput['type'], name: string) =>
    categoryRows.find((c) => c.type === type && sameName(c.name, name))?.id;

  // Explicit created_at keeps the entries in their original order.
  const base = Date.now();
  const entryRows = contents.entries.flatMap((e, i) => {
    const id = categoryId(e.type, e.category);
    return id
      ? [{ categoryId: id, label: e.label, amountCents: e.amountCents, note: e.note || null, sectionId: e.sectionId, lineId: e.lineId, createdAt: new Date(base + i) }]
      : [];
  });

  const queries: BatchItem<'pg'>[] = [];
  if (categoryRows.length > 0) queries.push(db.insert(categories).values(categoryRows));
  if (entryRows.length > 0) queries.push(db.insert(entries).values(entryRows));
  return queries;
}

function monthRow(userId: string, key: string, isSample: boolean) {
  return {
    id: crypto.randomUUID(),
    userId,
    key,
    isSample,
    sortIndex: isMonthKey(key) ? monthSortIndex(key) : CUSTOM_SORT_INDEX,
  };
}

/**
 * Create a month (PRD G4). With `copyRecurringFrom`, copies that month's categories and
 * the items in recurring categories; otherwise uses the default categories (A4).
 */
export async function createMonth(
  key: string,
  opts: { copyRecurringFrom?: string } = {},
): Promise<ActionResult<{ key: string }>> {
  const userId = await requireUserId();
  const existing = await db.query.months.findMany({ where: { userId }, columns: { key: true } });
  if (existing.some((m) => sameName(m.key, key))) return MONTH_EXISTS;

  let contents: MonthContents = { outOrder: DEFAULT_OUT_CATEGORIES, inOrder: DEFAULT_IN_CATEGORIES, entries: [] };
  if (opts.copyRecurringFrom) {
    const source = await db.query.months.findFirst({
      where: { userId, key: opts.copyRecurringFrom },
      columns: { id: true },
      with: {
        categories: {
          columns: { type: true, name: true },
          orderBy: { position: 'asc', createdAt: 'asc' },
          with: {
            entries: { columns: { label: true, amountCents: true, note: true, sectionId: true, lineId: true }, orderBy: { createdAt: 'asc', id: 'asc' } },
          },
        },
      },
    });
    if (source) {
      contents = {
        outOrder: source.categories.filter((c) => c.type === 'Out').map((c) => c.name),
        inOrder: source.categories.filter((c) => c.type === 'In').map((c) => c.name),
        entries: source.categories
          .filter((c) => RECURRING_CATEGORIES.includes(c.name))
          .flatMap((c) =>
            c.entries.map((e) => ({ type: c.type, category: c.name, label: e.label, amountCents: e.amountCents, note: e.note ?? '', sectionId: e.sectionId, lineId: e.lineId })),
          ),
      };
    }
  }

  const row = monthRow(userId, key, false);
  const batch: Batch = [ensureUserRow(userId), db.insert(months).values(row), ...contentInserts(row.id, contents)];
  await db.batch(batch);
  return ok({ key });
}

/** "Start fresh" (PRD A3/A4): the current calendar month with default categories. */
export async function startFresh(): Promise<ActionResult<{ key: string }>> {
  const key = monthKeyOf(new Date());
  const result = await createMonth(key);
  // Already there (e.g. a double click): just open it.
  if (!result.ok && result.code === 'exists') return ok({ key });
  return result;
}

/**
 * Load the Jan-25 sample (PRD A3), or restore it to its original state (PRD X2).
 * Other months, and budgets keyed by month, are untouched.
 */
export async function loadSampleMonth(): Promise<ActionResult<{ key: string }>> {
  const userId = await requireUserId();
  const seed = seedJan25();
  const contents: MonthContents = { outOrder: seed.outOrder, inOrder: seed.inOrder, entries: seed.entries };
  const existing = await findOwnedMonth(userId, SAMPLE_MONTH_KEY);

  if (existing && !existing.isSample) return MONTH_EXISTS;

  if (existing) {
    const owned = inArray(categories.monthId, ownedMonthIds(userId));
    const batch: Batch = [
      // Deleting the categories cascades to their entries.
      db.delete(categories).where(and(eq(categories.monthId, existing.id), owned)),
      db.delete(aiInsights).where(and(eq(aiInsights.monthId, existing.id), inArray(aiInsights.monthId, ownedMonthIds(userId)))),
      ...contentInserts(existing.id, contents),
    ];
    await db.batch(batch);
    return ok({ key: SAMPLE_MONTH_KEY });
  }

  const row = monthRow(userId, SAMPLE_MONTH_KEY, true);
  const batch: Batch = [ensureUserRow(userId), db.insert(months).values(row), ...contentInserts(row.id, contents)];
  await db.batch(batch);
  return ok({ key: SAMPLE_MONTH_KEY });
}
