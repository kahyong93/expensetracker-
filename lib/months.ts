/** Month keys look like "Jan-25". Custom labels are allowed (PRD Q7). */

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTH_KEY_RE = /^([A-Za-z]{3})-(\d{2})$/;

function parseMonthKey(key: string): { monthIndex: number; yy: number } | null {
  const match = MONTH_KEY_RE.exec(key);
  if (!match) return null;
  const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return null;
  return { monthIndex, yy: Number(match[2]) };
}

export function isMonthKey(key: string): boolean {
  return parseMonthKey(key) !== null;
}

/** "Jan-25" → "Feb-25", "Dec-25" → "Jan-26". Custom labels become "{label} (next)". */
export function nextOf(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return `${key} (next)`;
  if (parsed.monthIndex === 11) {
    return `Jan-${String((parsed.yy + 1) % 100).padStart(2, "0")}`;
  }
  return `${MONTH_NAMES[parsed.monthIndex + 1]}-${String(parsed.yy).padStart(2, "0")}`;
}

/** yyyymm sort index ("Jan-25" → 202501). Custom labels sort last. */
export function monthSortIndex(key: string): number {
  const parsed = parseMonthKey(key);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  return (2000 + parsed.yy) * 100 + parsed.monthIndex + 1;
}

/** Month keys in chronological order (stable for custom labels). */
export function sortMonthKeys(keys: readonly string[]): string[] {
  return keys
    .map((key, i) => ({ key, i, idx: monthSortIndex(key) }))
    .sort((a, b) => a.idx - b.idx || a.i - b.i)
    .map((x) => x.key);
}

/** The month key for a date, e.g. 2026-11-24 → "Nov-26". */
export function monthKeyOf(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]}-${String(date.getFullYear() % 100).padStart(2, "0")}`;
}

/** URL segment ↔ key. Keys may contain spaces/& for custom labels, so always encode. */
export function monthHref(key: string, tab: MonthTab = "dashboard"): string {
  const base = `/m/${encodeURIComponent(key)}`;
  return tab === "dashboard" ? base : `${base}/${tab}`;
}

/** The `[month]` URL segment → month key. Tolerates already-decoded and malformed values. */
export function decodeMonthParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type MonthTab ="dashboard" | "expenses" | "income" | "budget" | "ai";

export const MONTH_TABS: readonly MonthTab[] = ["dashboard", "expenses", "income", "budget", "ai"];

/** The tab for a pathname like "/m/Jan-25/expenses" (dashboard when none). */
export function tabFromPathname(pathname: string): MonthTab {
  const last = pathname.split("/").filter(Boolean)[2];
  return MONTH_TABS.find((t) => t === last) ?? "dashboard";
}
