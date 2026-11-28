/*
 * The fixed budget taxonomy: 3 sections, each with lines. Ported word for word from the
 * reference design's PLAN constant (docs/reference/Cashflow Tracker v2.dc.html).
 * Section and line ids are saved on entries and budgets: never rename them.
 * See GLOSSARY.md and docs/adr/0002-fixed-plan-taxonomy-for-expenses.md.
 */

export type SectionId = "needs" | "invest" | "fun";

export type PlanLine = { id: string; name: string; hint: string };

export type PlanSection = {
  id: SectionId;
  num: string;
  title: string;
  sub: string;
  color: string;
  tint: string;
  fg: string;
  bd: string;
  lines: readonly PlanLine[];
};

const L = (id: string, name: string, hint = ""): PlanLine => ({ id, name, hint });

export const PLAN: readonly PlanSection[] = [
  {
    id: "needs", num: "1", title: "Basic Needs", sub: "Fixed costs",
    color: "#7CC6F2", tint: "#E6F4FC", fg: "#1F6590", bd: "#CFE8F7",
    lines: [
      L("rent", "Rent / mortgage"), L("util", "Utilities", "Electricity, water, gas"), L("phone", "Phone and internet"),
      L("transport", "Transport", "Public transport, fuel, parking, car loan"), L("groceries", "Groceries", "Groceries and everyday meals"),
      L("insurance", "Insurance", "Health, life, car"), L("debt", "Loan or debt repayments", "Credit card, student loan"),
      L("family", "Family support", "Allowance for parents"), L("childcare", "Childcare or education fees", "If any"),
      L("subs", "Essential subscriptions", "Software, gym — ones you can't cut"),
    ],
  },
  {
    id: "invest", num: "2", title: "Investment / Savings", sub: "Paying your future self",
    color: "#7DD3B0", tint: "#E5F7EF", fg: "#1E6B52", bd: "#CDEFE0",
    lines: [
      L("emergency", "Emergency fund", "Aim for 3–6 months of expenses"), L("stocks", "Stocks, ETFs or unit trusts"),
      L("retire", "Retirement savings", "Voluntary CPF top-up or SRS"), L("fd", "Fixed deposits / savings bonds"),
      L("selfdev", "Self-development", "Courses, certifications, books"), L("sinking", "Sinking funds", "Travel, gadgets, festive season"),
    ],
  },
  {
    id: "fun", num: "3", title: "Entertainment", sub: "Lifestyle",
    color: "#FFB86B", tint: "#FFF1E0", fg: "#9A4F12", bd: "#FBDDBA",
    lines: [
      L("dining", "Dining out and food delivery"), L("events", "Movies, concerts, events"), L("streaming", "Streaming services", "Netflix, Spotify, etc."),
      L("shopping", "Shopping", "Clothes, gadgets"), L("hobbies", "Hobbies and sports"), L("travel", "Travel and short getaways"),
      L("gifts", "Gifts and celebrations", "Christmas and year-end parties"),
    ],
  },
];

export type PlanLineRef = PlanLine & { sectionId: SectionId };

export const PLAN_LINES: readonly PlanLineRef[] = PLAN.flatMap((s) => s.lines.map((l) => ({ ...l, sectionId: s.id })));

/** Category name used for expense entries that have no line yet. */
export const UNASSIGNED = "Unassigned";

export function getSection(id: string | null | undefined): PlanSection | undefined {
  return PLAN.find((s) => s.id === id);
}

export function getLine(id: string | null | undefined): PlanLineRef | undefined {
  return PLAN_LINES.find((l) => l.id === id);
}

/** True when `lineId` is a real line of `sectionId`. */
export function isLineOfSection(sectionId: string, lineId: string): boolean {
  return getLine(lineId)?.sectionId === sectionId;
}

/** Sections that carry unused budget into later months (reference SPEND_SECS, plus invest). */
export const SPEND_SECS: readonly SectionId[] = ["needs", "invest", "fun"];

// ── Split (target share of expected income per section) ─────────────────────
export type Split = Record<SectionId, number>;
export const SPLIT_DEFAULT: Split = { needs: 50, invest: 20, fun: 30 };

// ── Carry-over mode ─────────────────────────────────────────────────────────
export type CarryMode = "off" | "last" | "cum";
export const CARRY_MODES: readonly CarryMode[] = ["off", "last", "cum"];
export const CARRY_DEFAULT: CarryMode = "cum";

/** Split and carry as a new account has them, and as Reset to sample data restores them. */
export const DEFAULT_PLAN_PREFS: { split: Split; carryMode: CarryMode } = {
  split: SPLIT_DEFAULT,
  carryMode: CARRY_DEFAULT,
};

// ── Keyword backfill (reference mapEntry / MAP_RULES) ───────────────────────
const MAP_RULES: readonly (readonly [RegExp, string])[] = [
  [/parent|allowance|family/i, "family"], [/\brent|rental|mortgage/i, "rent"],
  [/telco|telcom|phone|mobile|internet|singtel|starhub|\bm1\b|circles/i, "phone"],
  [/electric|utilit|sp group|water|gas/i, "util"], [/insur|policy/i, "insurance"],
  [/sheng ?shiong|ntuc|fairprice|giant|cold storage|yuen|grocer|don don/i, "groceries"],
  [/netflix|spotify|disney|youtube|hbo/i, "streaming"],
  [/grab ?food|foodpanda|deliveroo|restaurant|cafe/i, "dining"],
  [/uniqlo|shopee|lazada|amazon|taobao|de novo/i, "shopping"],
  [/loan|credit card/i, "debt"], [/gym/i, "subs"], [/cinema|movie|concert|ticket/i, "events"],
  [/flight|hotel|airbnb|travel/i, "travel"],
];

/**
 * Guess a line id for an expense from its label, note and old category name, or null.
 * Used once to backfill entries that have no line; never to compute budgets.
 */
export function mapEntry(e: { label?: string; note?: string; category?: string }): string | null {
  const t = `${e.label ?? ""} ${e.note ?? ""}`;
  for (const [re, id] of MAP_RULES) if (re.test(t)) return id;
  const c = (e.category ?? "").toLowerCase();
  if (/food|meal/.test(c)) return "groceries";
  if (/transport/.test(c)) return "transport";
  if (/shop/.test(c)) return "shopping";
  return null;
}

/** Section and line ids for an expense, or nulls when nothing matches. */
export function placeEntry(e: { label?: string; note?: string; category?: string }): {
  sectionId: SectionId | null;
  lineId: string | null;
} {
  const line = getLine(mapEntry(e));
  return line ? { sectionId: line.sectionId, lineId: line.id } : { sectionId: null, lineId: null };
}
