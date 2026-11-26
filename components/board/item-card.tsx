"use client";

import type { DragEvent } from "react";
import { BOARD_COPY } from "@/components/board/board-copy";
import { Button } from "@/components/ui/button";
import { isPendingEntry } from "@/lib/optimistic";
import type { Entry } from "@/lib/types";
import { formatMoney, type DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Draggable item card (PRD B5–B7, DESIGN_SYSTEM §7.6): label, optional note, amount,
 * "Move to…" select (the keyboard / touch alternative to dragging), Edit and Delete.
 * The drag payload is the entry id as text/plain.
 */
export function ItemCard({
  entry,
  currency,
  moveOptions,
  showNote,
  isPhone,
  onDragStart,
  onDragEnd,
  onMove,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  currency: DisplayCurrency;
  /** Other categories of the board, in board order. */
  moveOptions: readonly string[];
  showNote: boolean;
  isPhone: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (category: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // An item that is still saving has no server id yet: lock its actions until it lands.
  const saving = isPendingEntry(entry);

  const handleDragStart = (e: DragEvent<HTMLLIElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", entry.id);
    onDragStart(entry.id);
  };

  const hit = isPhone ? "min-h-11" : undefined;

  return (
    <li
      draggable={!saving}
      aria-busy={saving || undefined}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-2 rounded-cf-item border-[1.5px] border-cf-line bg-cf-field px-3.5 py-[11px]",
        "transition-[background-color,border-color] duration-120 ease-out",
        saving ? "cursor-progress opacity-70" : "cursor-grab active:cursor-grabbing",
        "hover:border-cf-sparkle hover:bg-cf-surface",
      )}
    >
      <div className="flex justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-extrabold" title={entry.label}>
            {entry.label}
          </span>
          {showNote && entry.note ? <span className="text-[11px] text-cf-ink-muted">{entry.note}</span> : null}
        </div>
        <span className="text-[13px] font-extrabold whitespace-nowrap">{formatMoney(entry.amountCents, currency)}</span>
      </div>
      <div className="flex items-center justify-between gap-1.5">
        <select
          value=""
          onChange={(e) => onMove(e.target.value)}
          disabled={saving || moveOptions.length === 0}
          aria-label={`Move ${entry.label} to category`}
          className={cn(
            "max-w-[120px] min-w-0 rounded-cf-xs border-[1.5px] border-cf-line bg-cf-surface px-1.5 py-[3px] font-body text-[11px] text-cf-ink-soft",
            "disabled:cursor-not-allowed disabled:opacity-55",
            hit,
          )}
        >
          <option value="" disabled>
            {BOARD_COPY.moveTo}
          </option>
          {moveOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="flex shrink-0 gap-0.5">
          <Button variant="text" size="xs" className={hit} aria-label={`${BOARD_COPY.edit} ${entry.label}`} disabled={saving} onClick={onEdit}>
            {BOARD_COPY.edit}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className={hit}
            aria-label={`${BOARD_COPY.delete} ${entry.label}`}
            disabled={saving}
            onClick={onDelete}
          >
            {BOARD_COPY.delete}
          </Button>
        </span>
      </div>
    </li>
  );
}
