import { formatMoney, type DisplayCurrency } from "@/lib/money";

/** "+S$12.00 unused carried over" / "−S$3.00 overspent carried over" (reference carryTxt). */
export function carryText(cents: number, currency: DisplayCurrency): string {
  return `${cents >= 0 ? `+${formatMoney(cents, currency)} unused` : `${formatMoney(cents, currency)} overspent`} carried over`;
}
