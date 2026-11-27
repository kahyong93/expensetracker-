"use client";

import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Tag } from "@/components/ui/tag";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import type { EntryInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type ParsedRowItemProps = {
  row: EntryInput;
  currency: DisplayCurrency;
  onRemove: () => void;
};

/** Preview amount: income gets a leading "+" (PRD AI-6). */
function previewAmount(row: EntryInput, currency: DisplayCurrency): string {
  return `${row.type === "In" ? "+" : ""}${formatMoney(row.amountCents, currency)}`;
}

/** One extracted entry in the "Paste to add" preview: category chip, item, amount, remove ×. */
export function ParsedRowItem({ row, currency, onRemove }: ParsedRowItemProps) {
  const { isPhone } = useLayoutMode();
  return (
    <li className="flex items-center justify-between gap-2 rounded-cf-input border-[1.5px] border-cf-line bg-cf-field px-2.5 py-2">
      <span className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="sr-only">{row.type === "In" ? "Income" : "Expense"}: </span>
        <Tag tone={row.type === "In" ? "in" : "out"} size="sm">
          {row.category}
        </Tag>
        <span className="truncate font-extrabold">{row.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[13px] font-extrabold">{previewAmount(row, currency)}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.label}`}
          className={cn(
            "grid place-items-center rounded-cf-xs bg-transparent px-1 text-[15px] leading-none text-cf-ink-muted",
            "transition-[background-color] duration-120 ease-out hover:bg-cf-track",
            isPhone ? "min-h-11 min-w-11" : "min-h-6",
          )}
        >
          <span aria-hidden="true">×</span>
        </button>
      </span>
    </li>
  );
}
