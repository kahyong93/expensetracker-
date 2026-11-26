"use client";

import { useMemo, useRef, useState } from "react";
import { BoardColumn } from "@/components/board/board-column";
import { BOARD_COPY } from "@/components/board/board-copy";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { CategoryNameModal, type CategoryModalRequest } from "@/components/board/category-name-modal";
import { ShareBar } from "@/components/board/share-bar";
import { useEntryModal } from "@/components/entry/entry-modal-provider";
import { useMutate, type MonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { categoryBreakdown, entriesOfType, filterEntries, shareDecimals, type CategoryStat } from "@/lib/calc";
import type { Entry, EntryType } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { isPendingEntry } from "@/lib/optimistic";
import { deleteCategoryAction } from "@/server/actions/categories";
import { deleteEntryAction, moveEntryAction } from "@/server/actions/entries";

type ReadyView = Extract<MonthView, { status: "ready" }>;

type CategoryModalState = { seq: number; open: boolean; request: CategoryModalRequest };

/** The board for one type of the month in the URL (PRD §7.5 B1–B12). */
export function BoardView({ type, view }: { type: EntryType; view: ReadyView }) {
  const { monthKey, month, currency, budgets, settings } = view;
  const mutate = useMutate();
  const { isPhone } = useLayoutMode();
  const toast = useToast();
  const confirm = useConfirm();
  const { openAdd, openEdit } = useEntryModal();

  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openColumn, setOpenColumn] = useState<string | null>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState | null>(null);
  const dragId = useRef<string | null>(null);

  const stats = categoryBreakdown(month, type, budgets);
  const categories = stats.map((s) => s.name);
  const decimals = shareDecimals(type);
  const searching = search.trim() !== "";
  const showNotes = !settings.compactCards;

  const entries = useMemo(() => entriesOfType(month, type), [month, type]);
  const visibleByCategory = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filterEntries(entries, search)) {
      const list = map.get(e.category);
      if (list) list.push(e);
      else map.set(e.category, [e]);
    }
    return map;
  }, [entries, search]);

  // Mutations -----------------------------------------------------------------
  // Move and delete are optimistic (CLAUDE.md §8): a failed action rolls back with a toast.

  const move = async (id: string, category: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry || !category || entry.category === category || isPendingEntry(entry)) return;
    toast(BOARD_COPY.moved(entry.label, category));
    const res = await mutate({ kind: "moveEntry", id, category }, () => moveEntryAction(id, category));
    if (!res.ok) toast(BOARD_COPY.error);
  };

  const deleteItem = async (entry: Entry) => {
    const ok = await confirm({
      title: BOARD_COPY.deleteItemTitle,
      text: BOARD_COPY.deleteItemText(entry.label, formatMoney(entry.amountCents, currency), entry.category),
      ok: BOARD_COPY.deleteItemOk,
    });
    if (!ok) return;
    toast(BOARD_COPY.itemDeleted);
    const res = await mutate({ kind: "deleteEntry", id: entry.id }, () => deleteEntryAction(entry.id));
    if (!res.ok) toast(BOARD_COPY.error);
  };

  const removeColumn = async (stat: CategoryStat) => {
    if (stat.count > 0) {
      toast(BOARD_COPY.notEmpty(stat.count, stat.name));
      return;
    }
    const ok = await confirm({
      title: BOARD_COPY.removeTitle,
      text: BOARD_COPY.removeText(stat.name),
      ok: BOARD_COPY.removeOk,
    });
    if (!ok) return;
    const res = await mutate(null, () => deleteCategoryAction(monthKey, type, stat.name));
    if (!res.ok) {
      toast(res.code === "not_empty" ? res.message : BOARD_COPY.error);
      return;
    }
    toast(BOARD_COPY.removed(stat.name));
  };

  const openCategoryModal = (request: CategoryModalRequest) =>
    setCategoryModal((prev) => ({ seq: (prev?.seq ?? 0) + 1, open: true, request }));

  const closeCategoryModal = () => setCategoryModal((prev) => (prev ? { ...prev, open: false } : prev));

  const onRenamed = (oldName: string, newName: string) => {
    setOpenColumn((prev) => (prev === oldName ? newName : prev));
  };

  // Drag and drop ---------------------------------------------------------------

  const endDrag = () => {
    dragId.current = null;
    setDragOver(null);
  };

  const dropOn = (category: string, id: string) => {
    const entryId = id || dragId.current;
    endDrag();
    if (entryId) void move(entryId, category);
  };

  return (
    <div className="flex flex-col gap-4">
      <BoardToolbar
        type={type}
        search={search}
        onSearchChange={setSearch}
        onNewCategory={() => openCategoryModal({ kind: "new" })}
      />

      {stats.length > 0 ? (
        <>
          <ShareBar stats={stats} decimals={decimals} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-start gap-3.5">
            {stats.map((stat) => (
              <BoardColumn
                key={stat.name}
                stat={stat}
                items={visibleByCategory.get(stat.name) ?? []}
                otherCategories={categories.filter((c) => c !== stat.name)}
                decimals={decimals}
                currency={currency}
                isPhone={isPhone}
                searching={searching}
                open={!isPhone || searching || openColumn === stat.name}
                showNotes={showNotes}
                dragOver={dragOver === stat.name}
                onToggle={() => setOpenColumn((prev) => (prev === stat.name ? null : stat.name))}
                onDragEnter={() => setDragOver((prev) => (prev === stat.name ? prev : stat.name))}
                onDragLeave={() => setDragOver((prev) => (prev === stat.name ? null : prev))}
                onDropEntry={(id) => dropOn(stat.name, id)}
                onItemDragStart={(id) => {
                  dragId.current = id;
                }}
                onItemDragEnd={endDrag}
                onMove={(entry, category) => void move(entry.id, category)}
                onEdit={(entry) => openEdit(entry)}
                onDelete={(entry) => void deleteItem(entry)}
                onAdd={() => openAdd({ type, category: stat.name })}
                onRename={() => openCategoryModal({ kind: "rename", oldName: stat.name })}
                onRemove={() => void removeColumn(stat)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="m-0 grid h-[88px] place-items-center rounded-cf-inner border-2 border-dashed border-cf-line bg-cf-surface px-4 text-center text-xs text-cf-ink-muted">
          {BOARD_COPY.noCategories}
        </p>
      )}

      {categoryModal ? (
        <CategoryNameModal
          key={categoryModal.seq}
          open={categoryModal.open}
          request={categoryModal.request}
          type={type}
          monthKey={monthKey}
          onClose={closeCategoryModal}
          onRenamed={onRenamed}
        />
      ) : null}
    </div>
  );
}
