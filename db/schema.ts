import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * Normalized (3NF) schema. See CLAUDE.md §6.
 * - Money is integer SGD cents. Totals are always derived, never stored.
 * - Ownership: months / currency_rates / month_plans carry user_id; everything
 *   below a month is scoped by joining up to months.user_id.
 */

// ── Enums ────────────────────────────────────────────────────────────────────
export const currencyCode = pgEnum('currency_code', ['SGD', 'USD', 'INR', 'MYR', 'EUR', 'GBP']);
export const layoutMode = pgEnum('layout_mode', ['auto', 'phone', 'laptop']);
export const entryType = pgEnum('entry_type', ['Out', 'In']);
export const insightKind = pgEnum('insight_kind', ['summary', 'alerts', 'tips']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── users (1 row per Clerk user; holds the 1:1 settings) ────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user id
  currency: currencyCode('currency').notNull().default('SGD'),
  layout: layoutMode('layout').notNull().default('auto'),
  showAudit: boolean('show_audit').notNull().default(true),
  compactCards: boolean('compact_cards').notNull().default(false),
  autoCategorise: boolean('auto_categorise').notNull().default(true),
  // Last opened month. The URL is the source of truth; this is only a fallback.
  activeMonthId: uuid('active_month_id').references((): AnyPgColumn => months.id, {
    onDelete: 'set null',
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── currency_rates (user overrides only; defaults live in lib/money.ts) ─────
export const currencyRates = pgTable(
  'currency_rates',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: currencyCode('code').notNull(),
    // Units of `code` per S$1
    rate: numeric('rate', { precision: 12, scale: 6, mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.code] }),
    check('currency_rates_rate_positive', sql`${t.rate} > 0`),
    check('currency_rates_not_base', sql`${t.code} <> 'SGD'`),
  ],
);

// ── months ──────────────────────────────────────────────────────────────────
export const months = pgTable(
  'months',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // e.g. 'Jan-25' (custom labels allowed, PRD Q7)
    sortIndex: integer('sort_index').notNull(), // yyyymm, for chronological order
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('months_user_key_unique').on(t.userId, t.key),
    index('months_user_sort_idx').on(t.userId, t.sortIndex),
    check('months_key_not_blank', sql`length(trim(${t.key})) > 0`),
  ],
);

// ── categories (a month's board columns; type lives here, not on entries) ──
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monthId: uuid('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    type: entryType('type').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('categories_month_type_name_unique').on(t.monthId, t.type, sql`lower(${t.name})`),
    index('categories_month_type_position_idx').on(t.monthId, t.type, t.position),
    check('categories_name_not_blank', sql`length(trim(${t.name})) > 0`),
  ],
);

// ── entries (month and type are derived via the category) ───────────────────
export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // item / merchant / source
    amountCents: integer('amount_cents').notNull(), // SGD cents
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('entries_category_idx').on(t.categoryId),
    check('entries_amount_non_negative', sql`${t.amountCents} >= 0`),
    check('entries_label_not_blank', sql`length(trim(${t.label})) > 0`),
  ],
);

// ── month_plans (next-month plan; keyed by month key so it can exist before the month, PRD P8)
export const monthPlans = pgTable(
  'month_plans',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    monthKey: text('month_key').notNull(),
    expectedIncomeCents: integer('expected_income_cents'),
    aiNote: text('ai_note'),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.monthKey] }),
    check(
      'month_plans_expected_income_non_negative',
      sql`${t.expectedIncomeCents} IS NULL OR ${t.expectedIncomeCents} >= 0`,
    ),
  ],
);

// ── budget_lines (per expense category name within a plan) ───────────────────
export const budgetLines = pgTable(
  'budget_lines',
  {
    userId: text('user_id').notNull(),
    monthKey: text('month_key').notNull(),
    categoryName: text('category_name').notNull(),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.monthKey, t.categoryName] }),
    foreignKey({
      name: 'budget_lines_month_plan_fk',
      columns: [t.userId, t.monthKey],
      foreignColumns: [monthPlans.userId, monthPlans.monthKey],
    }).onDelete('cascade'),
    check('budget_lines_amount_non_negative', sql`${t.amountCents} >= 0`),
  ],
);

// ── ai_insights (cached summary / alerts / tips per month) ───────────────────
export const aiInsights = pgTable(
  'ai_insights',
  {
    monthId: uuid('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    kind: insightKind('kind').notNull(),
    payload: jsonb('payload').$type<unknown>().notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.monthId, t.kind] })],
);
