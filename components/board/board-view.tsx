"use client";

import { useMemo, useRef, useState } from "react";
import { BoardColumn } from "@/components/board/board-column";
import { BOARD_COPY } from "@/components/board/board-copy";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { SectionSpend } from "@/components/budget/section-spend";
import { CategoryNameModal, type CategoryModalRequest } from "@/components/board/category-name-modal";
import { ShareBar } from "@/components/board/share-bar";
import { useEntryModal } from "@/components/entry/entry-modal-provider";
import { useMutate, type MonthView } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import {
  categoryBreakdown,
  entriesOfType,
  filterEntries,
  lineBreakdown,
  sectionSpend,
  shareDecimals,
  UNASSIGNED_KEY,
  type CategoryStat,
  type LineStat,
} from "@/lib/calc";
import { PLAN, PLAN_LINES } from "@/lib/plan";
import type { Entry, EntryType } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { isPendingEntry } from "@/lib/optimistic";
import { deleteCategoryAction } from "@/server/actions/categories";
import { deleteEntryAction, moveEntryAction, moveEntryToLineAction } from "@/server/actions/entries";

type ReadyView = Extract<MonthView, { status: "ready" }>;

type CategoryModalState = { seq: number; open: boolean; request: CategoryModalRequest };

/** The board for one type of the month in the URL (PRD §7.5 B1–B12). */
export function BoardView({ type, view }: { type: EntryType; view: ReadyView }) {
  const { monthKey, month, currency, plan, carry, settings } = view;
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

  // Expenses: one column per plan line, grouped by section (PRD §7.10 S2). Income: user categories.
  const isOut = type === "Out";
  const columns: LineStat[] = isOut
    ? lineBreakdown(month, plan.lines, carry.byLine)
    : categoryBreakdown(month, type).map((s) => ({ ...s, key: s.name, lineId: null, sectionId: null }));
  const categories = columns.map((s) => s.name);
  const sections = isOut ? sectionSpend(month, plan.lines, carry.byLine) : [];
  const decimals = shareDecimals(type);
  const searching = search.trim() !== "";
  const showNotes = !settings.compactCards;

  const entries = useMemo(() => entriesOfType(month, type), [month, type]);
  const visibleByColumn = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of filterEntries(entries, search)) {
      const key = type === "Out" ? (e.lineId ?? UNASSIGNED_KEY) : e.category;
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [entries, search, type]);

  // Mutations -----------------------------------------------------------------
  // Move and delete are optimistic (CLAUDE.md §8): a failed action rolls back with a toast.

  const move = async (id: string, column: LineStat) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry || isPendingEntry(entry)) return;
    if (isOut) {
      // Expenses move between plan lines; Unassigned cannot be a target.
      const lineId = column.lineId;
      if (!lineId || entry.lineId === lineId) return;
      toast(BOARD_COPY.moved(entry.label, column.name));
      const res = await mutate({ kind: "moveEntryToLine", id, lineId }, () => moveEntryToLineAction(id, lineId));
      if (!res.ok) toast(BOARD_COPY.error);
      return;
    }
    if (entry.category === column.name) return;
    toast(BOARD_COPY.moved(entry.label, column.name));
    const res = await mutate({ kind: "moveEntry", id, category: column.name }, () => moveEntryAction(id, column.name));
    if (!res.ok) toast(BOARD_COPY.error);
  };

  /** "Move to…" picks a column by its name. */
  const moveByName = (id: string, name: string) => {
    const column = columns.find((c) => c.name === name);
    if (column) void move(id, column);
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
    if (isOut) return;
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

  const dropOn = (column: LineStat, id: string) => {
    const entryId = id || dragId.current;
    endDrag();
    if (entryId) void move(entryId, column);
  };

  const renderColumn = (stat: LineStat) => {
    const isUnassigned = stat.key === UNASSIGNED_KEY;
    const otherNames = isOut ? PLAN_LINES.map((l) => l.name) : categories;
    return (
      <BoardColumn
        key={stat.key}
        stat={stat}
        items={visibleByColumn.get(stat.key) ?? []}
        otherCategories={otherNames.filter((n) => n !== stat.name)}
        decimals={decimals}
        currency={currency}
        isPhone={isPhone}
        searching={searching}
        open={!isPhone || searching || openColumn === stat.key}
        showNotes={showNotes}
        dragOver={dragOver === stat.key}
        onToggle={() => setOpenColumn((prev) => (prev === stat.key ? null : stat.key))}
        onDragEnter={() => setDragOver((prev) => (prev === stat.key ? prev : stat.key))}
        onDragLeave={() => setDragOver((prev) => (prev === stat.key ? null : prev))}
        onDropEntry={(id) => dropOn(stat, id)}
        onItemDragStart={(id) => {
          dragId.current = id;
        }}
        onItemDragEnd={endDrag}
        onMove={(entry, name) => moveByName(entry.id, name)}
        onEdit={(entry) => openEdit(entry)}
        onDelete={(entry) => void deleteItem(entry)}
        onAdd={isUnassigned ? undefined : () => openAdd({ type, category: stat.name })}
        onRename={isOut ? undefined : () => openCategoryModal({ kind: "rename", oldName: stat.name })}
        onRemove={isOut ? undefined : () => void removeColumn(stat)}
      />
    );
  };

  const COLUMN_GRID = "grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-start gap-3.5";
  const shareStats = isOut ? columns.filter((s) => s.count > 0) : columns;
  const unassignedColumn = columns.find((s) => s.key === UNASSIGNED_KEY);

  return (
    <div className="flex flex-col gap-4">
      <BoardToolbar
        type={type}
        search={search}
        onSearchChange={setSearch}
        onNewCategory={() => openCategoryModal({ kind: "new" })}
      />

      {columns.length > 0 ? (
        <>
          <ShareBar stats={shareStats} decimals={decimals} />
          {isOut ? (
            <div className="flex flex-col gap-6">
              {PLAN.map((sec) => (
                <section key={sec.id} aria-label={sec.title} className="flex flex-col gap-3">
                  <h2 className="m-0 font-heading text-lg font-semibold" style={{ color: sec.fg }}>
                    {sec.num}. {sec.title} <span className="text-[13px] font-bold text-cf-ink-muted">{sec.sub}</span>
                  </h2>
                  <SectionSpend
                    spentCents={sections.find((s) => s.id === sec.id)?.spentCents ?? 0}
                    budget={sections.find((s) => s.id === sec.id)?.budget ?? null}
                    currency={currency}
                    className="max-w-[420px]"
                  />
                  <div className={COLUMN_GRID}>{columns.filter((c) => c.sectionId === sec.id).map(renderColumn)}</div>
                </section>
              ))}
              {unassignedColumn ? (
                <section aria-label="Unassigned" className="flex flex-col gap-3">
                  <h2 className="m-0 font-heading text-lg font-semibold text-cf-ink-soft">Unassigned</h2>
                  <div className={COLUMN_GRID}>{renderColumn(unassignedColumn)}</div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className={COLUMN_GRID}>{columns.map(renderColumn)}</div>
          )}
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
