/**
 * Shared validation (CLAUDE.md §9). The form validators run on the client for inline
 * errors; the `parse*` functions run in Server Actions on untrusted input and reject
 * anything malformed, out of range, or carrying unknown fields.
 */
import { CURRENCIES, prefilledInputToCents, type CurrencyCode, type DisplayCurrency, type PrefilledAmount } from "@/lib/money";
import {
  INSIGHT_KINDS,
  type EntryInput,
  type EntryType,
  type ChatTurn,
  type Insight,
  type InsightKind,
  type LayoutPref,
  type Settings,
} from "@/lib/types";

export const LIMITS = {
  label: 80,
  note: 140,
  category: 40,
  monthLabel: 20,
  /** One chat question typed by the user (AI-2). */
  chatMessage: 1000,
  /** One AI chat reply sent back as history (AI-2). */
  chatReply: 4000,
  /** 10 million SGD in cents: guards against typos like extra zeros. */
  maxAmountCents: 1_000_000_000,
} as const;

/** PRD E7 toast copy. */
export const ENTRY_INVALID_MESSAGE = "Please fill in item, category and amount";

export type EntryFormValues = {
  type: EntryType;
  label: string;
  /** Resolved category name (the new-category name when "+ New category…" is picked). */
  category: string;
  /** Raw amount string in the display currency. */
  amount: string;
  note: string;
};

export type EntryFieldErrors = Partial<Record<"label" | "category" | "amount" | "note", string>>;

export function validateEntry(
  values: EntryFormValues,
  currency: DisplayCurrency,
  /** Edit form: the stored amount, kept as-is while its pre-filled text is unchanged. */
  prefilled?: PrefilledAmount,
): { ok: true; data: EntryInput } | { ok: false; errors: EntryFieldErrors } {
  const errors: EntryFieldErrors = {};
  const label = values.label.trim();
  const category = values.category.trim();
  const note = values.note.trim();
  const amountCents = prefilledInputToCents(values.amount, currency, prefilled);

  if (!label) errors.label = "Required";
  else if (label.length > LIMITS.label) errors.label = `Keep it under ${LIMITS.label} characters`;
  if (!category) errors.category = "Required";
  else if (category.length > LIMITS.category) errors.category = `Keep it under ${LIMITS.category} characters`;
  if (amountCents == null) errors.amount = "Enter an amount of 0 or more";
  else if (amountCents > LIMITS.maxAmountCents) errors.amount = "That amount looks too large";
  if (note.length > LIMITS.note) errors.note = `Keep it under ${LIMITS.note} characters`;

  if (Object.keys(errors).length > 0 || amountCents == null) return { ok: false, errors };
  return { ok: true, data: { type: values.type, label, category, amountCents, note } };
}

export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Required";
  if (trimmed.length > LIMITS.category) return `Keep it under ${LIMITS.category} characters`;
  return null;
}

export function validateMonthLabel(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Required";
  if (trimmed.length > LIMITS.monthLabel) return `Keep it under ${LIMITS.monthLabel} characters`;
  return null;
}

// ---------------------------------------------------------------------------
// Server-side parsers for untrusted input. Each returns null when the value is invalid.

/** Caps how many rows one request may add or set (paste-to-add, budgets). */
export const MAX_ENTRIES_PER_REQUEST = 200;
/** AI-2 sends only the most recent part of the conversation. */
export const CHAT_HISTORY_LIMIT = 10;
const INSIGHT_TEXT_MAX = 600;
const INSIGHT_POINTS_MAX = 8;
const AI_NOTE_MAX = 600;
const MAX_RATE = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `value` is a plain object whose keys are exactly `keys` (no extras). */
function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((k) => k in value);
}

function boundedText(value: unknown, max: number, { required }: { required: boolean }): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (required && !trimmed) return null;
  return trimmed.length > max ? null : trimmed;
}

export function parseId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function parseEntryType(value: unknown): EntryType | null {
  return value === "Out" || value === "In" ? value : null;
}

export function parseCents(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= LIMITS.maxAmountCents
    ? value
    : null;
}

export function parseMonthLabel(value: unknown): string | null {
  return boundedText(value, LIMITS.monthLabel, { required: true });
}

/** Month keys used for budgets (P8) may be a next-month key such as "Custom (next)". */
export function parsePlanKey(value: unknown): string | null {
  return boundedText(value, LIMITS.monthLabel + " (next)".length, { required: true });
}

export function parseCategoryName(value: unknown): string | null {
  return boundedText(value, LIMITS.category, { required: true });
}

const ENTRY_KEYS = ["type", "category", "label", "amountCents", "note"] as const;

export function parseEntryInput(value: unknown): EntryInput | null {
  if (!hasExactKeys(value, ENTRY_KEYS)) return null;
  const type = parseEntryType(value.type);
  const category = parseCategoryName(value.category);
  const label = boundedText(value.label, LIMITS.label, { required: true });
  const amountCents = parseCents(value.amountCents);
  const note = boundedText(value.note, LIMITS.note, { required: false });
  if (!type || category == null || label == null || amountCents == null || note == null) return null;
  return { type, category, label, amountCents, note };
}

export function parseEntryInputs(value: unknown): EntryInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ENTRIES_PER_REQUEST) return null;
  const out: EntryInput[] = [];
  for (const item of value) {
    const parsed = parseEntryInput(item);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/** Category name → cents. Every name and amount must be valid. */
export function parseBudgets(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  const entries = Object.entries(value);
  if (entries.length > MAX_ENTRIES_PER_REQUEST) return null;
  for (const [name, cents] of entries) {
    const category = parseCategoryName(name);
    const amount = parseCents(cents);
    if (category == null || amount == null) return null;
    out[category] = amount;
  }
  return out;
}

const CHAT_KEYS = ["role", "content"] as const;

/** AI-2: up to CHAT_HISTORY_LIMIT turns, each within limits, ending with the user's question. */
export function parseChatMessages(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > CHAT_HISTORY_LIMIT) return null;
  const out: ChatTurn[] = [];
  for (const item of value) {
    if (!hasExactKeys(item, CHAT_KEYS)) return null;
    const role = item.role === "user" || item.role === "assistant" ? item.role : null;
    if (!role) return null;
    const max = role === "user" ? LIMITS.chatMessage : LIMITS.chatReply;
    const content = boundedText(item.content, max, { required: true });
    if (content == null) return null;
    out.push({ role, content });
  }
  return out[out.length - 1].role === "user" ? out : null;
}

export function parseAiNote(value: unknown): string | null {
  return boundedText(value, AI_NOTE_MAX, { required: false });
}

export function parseCurrencyCode(value: unknown): CurrencyCode | null {
  return typeof value === "string" ? (CURRENCIES.find((c) => c.code === value)?.code ?? null) : null;
}

export function parseRate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_RATE ? value : null;
}

export function parseLayout(value: unknown): LayoutPref | null {
  return value === "auto" || value === "phone" || value === "laptop" ? value : null;
}

const SETTING_KEYS = ["autoCategorise", "compactCards", "showAudit"] as const satisfies readonly (keyof Settings)[];

/** A settings patch: only known keys, booleans only, at least one key. */
export function parseSettingsPatch(value: unknown): Partial<Settings> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  const patch: Partial<Settings> = {};
  for (const [key, flag] of entries) {
    const known = SETTING_KEYS.find((k) => k === key);
    if (!known || typeof flag !== "boolean") return null;
    patch[known] = flag;
  }
  return patch;
}

export function parseInsightKind(value: unknown): InsightKind | null {
  return INSIGHT_KINDS.find((k) => k === value) ?? null;
}

/** AI insight shape `{headline, points:[{title,text}]}` (CLAUDE.md §7). */
export function parseInsight(value: unknown): Insight | null {
  if (!hasExactKeys(value, ["headline", "points"]) || !Array.isArray(value.points)) return null;
  const headline = boundedText(value.headline, INSIGHT_TEXT_MAX, { required: true });
  if (headline == null || value.points.length > INSIGHT_POINTS_MAX) return null;
  const points: Insight["points"] = [];
  for (const point of value.points) {
    if (!hasExactKeys(point, ["title", "text"])) return null;
    const title = boundedText(point.title, INSIGHT_TEXT_MAX, { required: true });
    const text = boundedText(point.text, INSIGHT_TEXT_MAX, { required: true });
    if (title == null || text == null) return null;
    points.push({ title, text });
  }
  return { headline, points };
}
