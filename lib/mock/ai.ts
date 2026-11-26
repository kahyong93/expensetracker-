"use client";

/**
 * Frontend-only AI stub. Returns hard-coded sample responses after a short delay so the
 * UI can show busy states. The real implementation will call /api/ai/* route handlers.
 * Results use the ActionResult shape; error messages are the PRD toast copy.
 */
import type { ActionResult, EntryType, Insight, InsightKind } from "@/lib/types";

import { PASTE_MAX_CHARS } from "@/lib/ai-messages";

export { AI_BAD_REPLY_MESSAGE, AI_BUSY_MESSAGE, PASTE_MAX_CHARS } from "@/lib/ai-messages";

const DELAY_MS = 900;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respond<T>(data: T): Promise<ActionResult<T>> {
  await wait(DELAY_MS);
  return { ok: true, data };
}

// AI-1 Auto-categorise --------------------------------------------------------

const CATEGORY_HINTS: Array<{ words: string[]; category: string }> = [
  { words: ["kopi", "rice", "food", "lunch", "dinner", "coffee", "mcd", "bread"], category: "Food" },
  { words: ["grab", "mrt", "bus", "taxi", "gojek", "transport", "ez-link"], category: "Transport" },
  { words: ["rent", "rental", "telco", "telcom", "singtel", "bill", "parent"], category: "Fixed & Bills" },
  { words: ["uniqlo", "shopee", "lazada", "insurance", "sheng", "ntuc"], category: "Shopping & Insurance" },
  { words: ["salary", "work", "bonus"], category: "Work" },
  { words: ["reimburse", "claim"], category: "Reimburse" },
  { words: ["interest", "dbs", "ocbc", "uob", "cdp"], category: "Interest" },
];

export async function suggestCategory(input: {
  label: string;
  type: EntryType;
  categories: readonly string[];
}): Promise<ActionResult<{ category: string }>> {
  const label = input.label.toLowerCase();
  const hint = CATEGORY_HINTS.find((h) => h.words.some((w) => label.includes(w)));
  const proposed = hint?.category ?? (input.type === "Out" ? "Misc" : "Other income");
  return respond({ category: proposed });
}

// AI-3/5/7 Insight cards ------------------------------------------------------

const SAMPLE_INSIGHTS: Record<InsightKind, Insight> = {
  summary: {
    headline: "A big insurance month, but you still kept something aside.",
    points: [
      { title: "Biggest driver", text: "Insurance Policy #2 made up most of your Shopping & Insurance spend." },
      { title: "Savings result", text: "You saved about 14.6% of what you earned this month." },
      { title: "Notable pattern", text: "Small transport trips add up: 25 rides averaged under S$5 each." },
    ],
  },
  alerts: {
    headline: "Two things stood out this month.",
    points: [
      { title: "One-off spike", text: "Insurance Policy #2 at S$3,299.25 is far above a normal month." },
      { title: "Small spends add up", text: "Uniqlo appeared 5 times for S$401.60 in total." },
    ],
  },
  tips: {
    headline: "Three easy wins for next month.",
    points: [
      { title: "Pause Uniqlo", text: "Skipping two purchases could save about S$150 a month." },
      { title: "Pack lunch twice a week", text: "Food could drop by around S$30 a month." },
      { title: "Walk short trips", text: "Cutting the shortest rides may save about S$15 a month." },
    ],
  },
};

export async function generateInsight(input: { kind: InsightKind; monthKey: string }): Promise<ActionResult<Insight>> {
  return respond(SAMPLE_INSIGHTS[input.kind]);
}

// AI-4 Smart budget -----------------------------------------------------------

export async function suggestBudget(input: {
  /** Expense category → this month's actual, in SGD cents. */
  actuals: Record<string, number>;
  expectedCents: number;
  nextKey: string;
}): Promise<ActionResult<{ budgets: Record<string, number>; note: string }>> {
  const budgets: Record<string, number> = {};
  for (const [category, cents] of Object.entries(input.actuals)) {
    // Treat very large one-offs as non-recurring; trim the rest by ~5%.
    budgets[category] = cents > 200000 ? Math.round(cents * 0.15) : Math.round(cents * 0.95);
  }
  return respond({
    budgets,
    note: `I treated the large insurance payment as a one-off and trimmed the rest slightly, leaving more room to save in ${input.nextKey}.`,
  });
}

// AI-6 Paste to add -----------------------------------------------------------

export type ParsedRow = {
  type: EntryType;
  category: string;
  label: string;
  /** SGD cents. */
  amountCents: number;
  note: string;
};

export async function parsePaste(input: { text: string }): Promise<ActionResult<ParsedRow[]>> {
  if (input.text.length > PASTE_MAX_CHARS) {
    await wait(DELAY_MS);
    return { ok: false, code: "too_long", message: `Paste up to ${PASTE_MAX_CHARS.toLocaleString("en-US")} characters` };
  }
  return respond<ParsedRow[]>([
    { type: "Out", category: "Transport", label: "Grab", amountCents: 1250, note: "03 Feb" },
    { type: "Out", category: "Food", label: "Kopi", amountCents: 180, note: "" },
    { type: "Out", category: "Food", label: "Chicken rice", amountCents: 450, note: "" },
  ]);
}
