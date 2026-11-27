"use client";

/**
 * Frontend-only AI stub. Returns hard-coded sample responses after a short delay so the
 * UI can show busy states. The real implementation will call /api/ai/* route handlers.
 * Results use the ActionResult shape; error messages are the PRD toast copy.
 */
import type { ActionResult, EntryType } from "@/lib/types";


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
