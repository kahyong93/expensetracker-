import type { CurrencyCode } from "@/lib/money";
import type { CarryMode, Split } from "@/lib/plan";

/**
 * Domain shapes shared by the server (`/data`, Server Actions) and the client. Money is
 * integer SGD cents. An entry's type and category name come from its category row.
 */

export type EntryType = "Out" | "In";

export type Entry = {
  id: string;
  type: EntryType;
  category: string;
  label: string;
  amountCents: number;
  note: string;
  /** Budget plan section id (lib/plan.ts). Expenses only; null for income and Unassigned. */
  sectionId: string | null;
  /** Budget plan line id (lib/plan.ts). Expenses only; null for income and Unassigned. */
  lineId: string | null;
};

export type EntryInput = Omit<Entry, "id">;

export type MonthData = {
  key: string;
  entries: Entry[];
  /** Saved column order for expense categories. */
  outOrder: string[];
  /** Saved column order for income categories. */
  inOrder: string[];
  isSample: boolean;
};

/** One turn of the AI-2 chat, as sent to the server. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type InsightKind = "summary" | "alerts" | "tips";

export const INSIGHT_KINDS: readonly InsightKind[] = ["summary", "alerts", "tips"];

export type InsightPoint = { title: string; text: string };

export type Insight = { headline: string; points: InsightPoint[] };

export type LayoutPref = "auto" | "phone" | "laptop";

export type Settings = {
  autoCategorise: boolean;
  compactCards: boolean;
  showAudit: boolean;
};

/** Per-user data every month page needs (header, layout mode, currency). */
export type AppData = {
  /** The user's month keys in chronological order. */
  monthKeys: string[];
  currency: CurrencyCode;
  /** User rate overrides (units per S$1). Defaults live in lib/money.ts. */
  rates: Partial<Record<CurrencyCode, number>>;
  layout: LayoutPref;
  settings: Settings;
  /** Budget plan preferences: target split per section and how unused budget carries over. */
  planPrefs: PlanPrefs;
};

export type PlanPrefs = { split: Split; carryMode: CarryMode };

/** Budgets, expected income and AI note for one month key (can exist before the month, PRD P8). */
export type MonthPlan = {
  /** Category name → budget in SGD cents (legacy key; removed with the contract ticket). */
  budgets: Record<string, number>;
  /** Plan line id (lib/plan.ts) → budget in SGD cents. */
  lines: Record<string, number>;
  expectedCents: number | null;
  aiNote: string | null;
};

/** Everything loaded for the month in the URL. */
export type MonthBundle = {
  month: MonthData;
  /** Budgets set for this month (budget status on the dashboard and boards). */
  budgets: Record<string, number>;
  /** The plan for the month after this one (Budget tab, CSV export). */
  nextPlan: MonthPlan;
  /** Cached AI insight cards for this month. */
  insights: Partial<Record<InsightKind, Insight>>;
};

/** What the month layout (a Server Component) loads and hands to the client tree. */
export type CashflowData = {
  app: AppData;
  monthKey: string;
  /** null when the user has no month with this key. */
  bundle: MonthBundle | null;
};

/** Result shape of every Server Action (CLAUDE.md §9). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };
