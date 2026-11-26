/**
 * Money helpers. Amounts are stored as integer cents in SGD (CLAUDE.md §6).
 * Convert only at the edges: display = cents / 100 * rate, input = round(value / rate * 100).
 */

export type CurrencyCode = "SGD" | "USD" | "INR" | "MYR" | "EUR" | "GBP";

export type CurrencyDef = { code: CurrencyCode; sym: string; rate: number };

/** A resolved display currency: symbol plus the rate in effect (default or user override). */
export type DisplayCurrency = CurrencyDef;

export const CURRENCIES: readonly CurrencyDef[] = [
  { code: "SGD", sym: "S$", rate: 1 },
  { code: "USD", sym: "US$", rate: 0.77 },
  { code: "INR", sym: "₹", rate: 66.5 },
  { code: "MYR", sym: "RM", rate: 3.3 },
  { code: "EUR", sym: "€", rate: 0.67 },
  { code: "GBP", sym: "£", rate: 0.58 },
];

export const BASE_CURRENCY: DisplayCurrency = CURRENCIES[0];

const MINUS = "−";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((c) => c.code === value);
}

/** The option label used in the header select, e.g. "S$ SGD". */
export function currencyLabel(c: CurrencyDef): string {
  return `${c.sym} ${c.code}`;
}

/** Resolve a currency code plus optional user rate overrides to a display currency. */
export function resolveCurrency(
  code: CurrencyCode,
  overrides: Partial<Record<CurrencyCode, number>> = {},
): DisplayCurrency {
  const def = CURRENCIES.find((c) => c.code === code) ?? BASE_CURRENCY;
  if (def.code === "SGD") return def;
  const override = overrides[def.code];
  return { ...def, rate: override && override > 0 ? override : def.rate };
}

/** Display value (in the display currency) for an SGD cents amount. */
export function centsToDisplayNumber(cents: number, currency: DisplayCurrency): number {
  return (cents / 100) * currency.rate;
}

/**
 * Format SGD cents in the display currency: symbol + en-US grouping, 2 decimals,
 * true minus (U+2212) for negatives. E.g. "S$1,234.50", "−S$12.00".
 */
export function formatMoney(cents: number, currency: DisplayCurrency = BASE_CURRENCY): string {
  const value = centsToDisplayNumber(cents, currency);
  const negative = value < -0.004;
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? MINUS : ""}${currency.sym}${abs}`;
}

/** Raw input string (2 decimals, no symbol, no grouping) for pre-filling an amount input. */
export function centsToInput(cents: number, currency: DisplayCurrency = BASE_CURRENCY): string {
  return centsToDisplayNumber(cents, currency).toFixed(2);
}

/**
 * Parse a user-typed amount in the display currency to SGD cents.
 * Returns null for empty, non-numeric or negative input.
 */
export function inputToCents(raw: string, currency: DisplayCurrency = BASE_CURRENCY): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value / currency.rate) * 100);
}

/** A stored amount and the text it was pre-filled into an input as. */
export type PrefilledAmount = { input: string; cents: number };

/**
 * SGD cents for an amount input that was pre-filled from a stored value (edit forms).
 * If the text is unchanged, the stored cents are kept: a display currency worth less
 * than S$1 can't show every SGD cent, so converting the rounded text back would drift
 * (e.g. 101 cents shown as £0.59 converts back to 102).
 */
export function prefilledInputToCents(
  raw: string,
  currency: DisplayCurrency,
  prefilled?: PrefilledAmount,
): number | null {
  if (prefilled && raw.trim() === prefilled.input.trim()) return prefilled.cents;
  return inputToCents(raw, currency);
}

/** Convert a decimal SGD amount (e.g. from seed data) to integer cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
