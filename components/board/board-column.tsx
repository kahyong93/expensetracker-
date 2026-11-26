"use client";

import { useId, type DragEvent } from "react";
import { BOARD_COPY } from "@/components/board/board-copy";
import { ColumnHeader } from "@/components/board/column-header";
import { ItemCard } from "@/components/board/item-card";
import type { CategoryStat } from "@/lib/calc";
import type { Entry } from "@/lib/types";
import type { DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

const FOOTER_BUTTON =
  "w-full border-0 border-t-[1.5px] border-solid border-cf-track bg-cf-surface font-body text-xs font-extrabold transition-[background-color] duration-120 ease-out";

/**
 * One board column (PRD B4–B8, B12). The whole column is a drop target and highlights
 * while an item is dragged over it. On phone the items are collapsed behind a
 * "Show N items ▼" toggle unless a search is active.
 */
export function BoardColumn({
  stat,
  items,
  otherCategories,
  decimals,
  currency,
  isPhone,
  searching,
  open,
  showNotes,
  dragOver,
  onToggle,
  onDragEnter,
  onDragLeave,
  onDropEntry,
  onItemDragStart,
  onItemDragEnd,
  onMove,
  onEdit,
  onDelete,
  onAdd,
  onRename,
  onRemove,
}: {
  stat: CategoryStat;
  /** Entries of this column that match the search, in entry order. */
  items: readonly Entry[];
  otherCategories: readonly string[];
  decimals: number;
  currency: DisplayCurrency;
  isPhone: boolean;
  searching: boolean;
  /** Items are visible (always on laptop; toggled or searching on phone). */
  open: boolean;
  showNotes: boolean;
  dragOver: boolean;
  onToggle: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDropEntry: (id: string) => void;
  onItemDragStart: (id: string) => void;
  onItemDragEnd: () => void;
  onMove: (entry: Entry, category: string) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onAdd: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const listId = `${baseId}-items`;

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragEnter();
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    onDragLeave();
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    onDropEntry(e.dataTransfer.getData("text/plain"));
  };

  const showToggle = isPhone && !searching;

  return (
    <section
      aria-labelledby={nameId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col overflow-hidden rounded-cf-column border-2 bg-cf-surface",
        "transition-[border-color,box-shadow] duration-120 ease-out",
        dragOver ? "border-cf-primary shadow-cf-drop" : "border-cf-line shadow-cf-column",
      )}
    >
      <ColumnHeader
        stat={stat}
        nameId={nameId}
        decimals={decimals}
        currency={currency}
        isPhone={isPhone}
        onRename={onRename}
        onRemove={onRemove}
      />

      {open ? (
        <>
          <div
            id={listId}
            className={cn(
              "flex min-h-[110px] flex-col gap-2 overflow-y-auto p-2.5",
              isPhone ? "max-h-[340px]" : "max-h-[460px]",
            )}
          >
            {items.length > 0 ? (
              <ul aria-labelledby={nameId} className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((entry) => (
                  <ItemCard
                    key={entry.id}
                    entry={entry}
                    currency={currency}
                    moveOptions={otherCategories}
                    showNote={showNotes}
                    isPhone={isPhone}
                    onDragStart={onItemDragStart}
                    onDragEnd={onItemDragEnd}
                    onMove={(category) => onMove(entry, category)}
                    onEdit={() => onEdit(entry)}
                    onDelete={() => onDelete(entry)}
                  />
                ))}
              </ul>
            ) : (
              <div className="grid h-[88px] place-items-center rounded-cf-inner border-2 border-dashed border-cf-line text-xs text-cf-ink-muted">
                {BOARD_COPY.dropHere}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onAdd}
            className={cn(FOOTER_BUTTON, "p-2.5 text-cf-ink-soft hover:bg-cf-bg", isPhone && "min-h-11")}
          >
            {BOARD_COPY.addTo(stat.name)}
          </button>
        </>
      ) : null}

      {showToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className={cn(FOOTER_BUTTON, "min-h-11 p-[11px] text-cf-primary hover:bg-cf-bg")}
        >
          {open ? BOARD_COPY.hideItems : BOARD_COPY.showItems(stat.count)}
        </button>
      ) : null}
    </section>
  );
}
