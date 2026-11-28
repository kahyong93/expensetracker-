import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '@/db';
import { aiInsights, categories, entries, monthPlans, months, users } from '@/db/schema';
import { carryInto, NO_CARRY, type CarryInfo, type MonthSnapshot } from '@/lib/carry';
import { CARRY_DEFAULT, DEFAULT_PLAN_PREFS, placeEntry } from '@/lib/plan';
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
  row: { expectedIncomeCents: number | null; aiNote: string | null; budgetLines: { lineId: string; amountCents: number }[] } | undefined,
): MonthPlan {
  const lines: Record<string, number> = {};
  for (const line of row?.budgetLines ?? []) lines[line.lineId] = line.amountCents;
  return { lines, expectedCents: row?.expectedIncomeCents ?? null, aiNote: row?.aiNote || null };
}

/**
 * Carry-over into `key` and into the month after it. Needs every earlier month that has a
 * plan, with its spend per plan line (expenses saved before sections existed are placed by
 * the keyword rules, like on read).
 */
async function loadCarry(userId: string, key: string, nextKey: string): Promise<{ carry: CarryInfo; nextCarry: CarryInfo }> {
  const [user, plans] = await Promise.all([
    db.query.users.findFirst({ where: { id: userId }, columns: { carryMode: true } }),
    db.query.monthPlans.findMany({
      where: { userId },
      columns: { monthKey: true },
      with: { budgetLines: { columns: { lineId: true, amountCents: true } } },
    }),
  ]);
  const mode = user?.carryMode ?? CARRY_DEFAULT;
  if (mode === 'off') return { carry: NO_CARRY, nextCarry: NO_CARRY };

  const budgetsByKey = new Map<string, Record<string, number>>();
  for (const p of plans) {
    const budgets: Record<string, number> = {};
    for (const l of p.budgetLines) budgets[l.lineId] = l.amountCents;
    if (Object.keys(budgets).length > 0 && p.monthKey !== key && p.monthKey !== nextKey) budgetsByKey.set(p.monthKey, budgets);
  }
  if (budgetsByKey.size === 0) return { carry: NO_CARRY, nextCarry: NO_CARRY };

  const months = await db.query.months.findMany({
    where: { userId, key: { in: [...budgetsByKey.keys()] } },
    columns: { key: true },
    with: {
      categories: {
        columns: { type: true, name: true },
        with: { entries: { columns: { label: true, note: true, amountCents: true, lineId: true } } },
      },
    },
  });

  // Only months that exist can carry; a plan alone has no spend to compare with.
  const history: MonthSnapshot[] = months.map((m) => {
    const actuals: Record<string, number> = {};
    for (const c of m.categories) {
      if (c.type !== 'Out') continue;
      for (const e of c.entries) {
        const lineId = e.lineId ?? placeEntry({ label: e.label, note: e.note ?? '', category: c.name }).lineId;
        if (lineId) actuals[lineId] = (actuals[lineId] ?? 0) + e.amountCents;
      }
    }
    return { key: m.key, budgets: budgetsByKey.get(m.key) ?? {}, actuals };
  });
  return { carry: carryInto(key, mode, history), nextCarry: carryInto(nextKey, mode, history) };
}

/**
 * The user's month with this key: categories in saved order, entries in the order they
 * were added, this month's budgets, next month's plan and cached AI insights.
 * Returns null when the user has no such month.
 */
export async function getMonthBundle(key: string): Promise<MonthBundle | null> {
  const userId = await requireUserId();
  const nextKey = nextOf(key);

  const [month, plans, carryInfo] = await Promise.all([
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
      with: { budgetLines: { columns: { lineId: true, amountCents: true } } },
    }),
    loadCarry(userId, key, nextKey),
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
    plan: toPlan(plans.find((p) => p.monthKey === key)),
    carry: carryInfo.carry,
    nextCarry: carryInfo.nextCarry,
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
 * PRD S7: Reset to sample data clears every plan of the user (budgets cascade, with expected
 * income and the AI note) and puts split and carry back to their defaults. The users row must
 * already exist.
 */
function resetPlan(userId: string): [BatchItem<'pg'>, BatchItem<'pg'>] {
  return [
    db.delete(monthPlans).where(eq(monthPlans.userId, userId)),
    db
      .update(users)
      .set({
        splitNeeds: DEFAULT_PLAN_PREFS.split.needs,
        splitInvest: DEFAULT_PLAN_PREFS.split.invest,
        splitFun: DEFAULT_PLAN_PREFS.split.fun,
        carryMode: DEFAULT_PLAN_PREFS.carryMode,
      })
      .where(eq(users.id, userId)),
  ];
}

/**
 * Load the Jan-25 sample (PRD A3), or restore it to its original state (PRD X2).
 * Other months are untouched; plans, split and carry are reset (PRD S7).
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
      ...resetPlan(userId),
      ...contentInserts(existing.id, contents),
    ];
    await db.batch(batch);
    return ok({ key: SAMPLE_MONTH_KEY });
  }

  const row = monthRow(userId, SAMPLE_MONTH_KEY, true);
  // The footer's Reset lands here too when the user has no sample month yet: it clears the plan all the same.
  const batch: Batch = [ensureUserRow(userId), db.insert(months).values(row), ...resetPlan(userId), ...contentInserts(row.id, contents)];
  await db.batch(batch);
  return ok({ key: SAMPLE_MONTH_KEY });
}
