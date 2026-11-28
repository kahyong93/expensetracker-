"use client";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import { useMonthView, useMutate } from "@/components/providers/cashflow-data-provider";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { categoriesOf } from "@/lib/calc";
import type { Entry, EntryType } from "@/lib/types";
import { getSection, PLAN, PLAN_LINES } from "@/lib/plan";
import { centsToInput, type PrefilledAmount } from "@/lib/money";
import { monthHref, tabFromPathname } from "@/lib/months";
import { pendingEntryId } from "@/lib/optimistic";
import { cn } from "@/lib/utils";
import { ENTRY_INVALID_MESSAGE, validateEntry, type EntryFieldErrors } from "@/lib/validation";
import { suggestCategoryAction } from "@/server/actions/ai";
import { addEntryAction, updateEntryAction } from "@/server/actions/entries";

export type EntryModalRequest =
  | { mode: "add"; type: EntryType; category?: string }
  | { mode: "edit"; entry: Entry };

const NEW_CATEGORY = "__NEW__";
const PREFILL_LABEL_CATEGORIES = ["Food", "Transport"];

type FormState = {
  type: EntryType;
  category: string;
  newCategory: string;
  /** Expenses: plan section and line ids ("" = not chosen yet). */
  sectionId: string;
  lineId: string;
  label: string;
  amount: string;
  note: string;
  /** The user picked a category themselves: auto-categorise stays off. */
  categoryTouched: boolean;
  /** Label the last suggestion ran for. */
  suggestedFor: string;
};

export function EntryModal({ request, onClose }: { request: EntryModalRequest; onClose: () => void }) {
  const view = useMonthView();
  const mutate = useMutate();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const ids = useId();
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<EntryFieldErrors>({});
  // Edit: the stored amount and the text it was pre-filled as, so an untouched amount
  // keeps its exact cents in any display currency.
  const [prefilled] = useState<PrefilledAmount | undefined>(() =>
    request.mode === "edit" && view.status === "ready"
      ? { input: centsToInput(request.entry.amountCents, view.currency), cents: request.entry.amountCents }
      : undefined,
  );

  const [form, setForm] = useState<FormState>(() => {
    if (view.status !== "ready") {
      return { type: "Out", category: "", newCategory: "", sectionId: "", lineId: "", label: "", amount: "", note: "", categoryTouched: false, suggestedFor: "" };
    }
    if (request.mode === "edit") {
      const e = request.entry;
      return {
        type: e.type,
        category: e.category,
        newCategory: "",
        sectionId: e.sectionId ?? "",
        lineId: e.lineId ?? "",
        label: e.label,
        amount: centsToInput(e.amountCents, view.currency),
        note: e.note,
        categoryTouched: true,
        suggestedFor: "",
      };
    }
    const cats = categoriesOf(view.month, request.type);
    const category = request.category ?? cats[0] ?? NEW_CATEGORY;
    // "+ Add to {column}" on an expense column named like a plan line pre-selects that line.
    const preLine = request.type === "Out" && request.category
      ? PLAN_LINES.find((l) => l.name.toLowerCase() === request.category!.toLowerCase())
      : undefined;
    return {
      type: request.type,
      category,
      newCategory: "",
      sectionId: preLine?.sectionId ?? "",
      lineId: preLine?.id ?? "",
      label: PREFILL_LABEL_CATEGORIES.includes(category) ? category : "",
      amount: "",
      note: "",
      categoryTouched: !!request.category,
      suggestedFor: "",
    };
  });

  if (view.status !== "ready") return null;
  const { month, monthKey, currency, settings } = view;
  const categories = categoriesOf(month, form.type);
  const isEdit = request.mode === "edit";

  const close = () => {
    setOpen(false);
    onClose();
  };

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const pickType = (type: EntryType) => {
    if (type === form.type) return;
    set({ type, category: categoriesOf(month, type)[0] ?? NEW_CATEGORY, newCategory: "", sectionId: "", lineId: "" });
  };

  const runSuggest = async () => {
    const label = form.label.trim();
    if (!label) {
      toast("Type the item name first");
      return;
    }
    set({ suggestedFor: label });
    setBusy(true);
    const res = await suggestCategoryAction(monthKey, { type: form.type, label, note: form.note });
    setBusy(false);
    if (!res.ok) {
      toast(res.message);
      return;
    }
    const proposed = res.data.category.trim();
    if (form.type === "Out") {
      // Expenses: the AI picked a plan line, so both selects are filled.
      if (!res.data.sectionId || !res.data.lineId) {
        toast("No matching category, please pick one");
        return;
      }
      set({ sectionId: res.data.sectionId, lineId: res.data.lineId });
      toast(`Suggested category: ${proposed}`);
      return;
    }
    const hit = categories.find((c) => c.toLowerCase() === proposed.toLowerCase());
    set(hit ? { category: hit, newCategory: "" } : { category: NEW_CATEGORY, newCategory: proposed });
    toast(`Suggested category: ${hit ?? proposed}`);
  };

  const onLabelBlur = () => {
    const label = form.label.trim();
    if (settings.autoCategorise && !isEdit && !form.categoryTouched && label && form.suggestedFor !== label && !busy) {
      void runSuggest();
    }
  };

  const submit = async () => {
    const category = form.category === NEW_CATEGORY ? form.newCategory : form.category;
    const result = validateEntry(
      { type: form.type, label: form.label, category, amount: form.amount, note: form.note, sectionId: form.sectionId, lineId: form.lineId },
      currency,
      prefilled,
    );
    if (!result.ok) {
      setErrors(result.errors);
      toast(ENTRY_INVALID_MESSAGE);
      return;
    }
    // Optimistic (CLAUDE.md §8): the item shows at once; a failure rolls it back.
    const input = result.data;
    const pending = isEdit
      ? mutate({ kind: "saveEntry", entry: { ...input, id: request.entry.id } }, () =>
          updateEntryAction(request.entry.id, input),
        )
      : mutate({ kind: "saveEntry", entry: { ...input, id: pendingEntryId() } }, () =>
          addEntryAction(monthKey, input),
        );
    close();
    // PRD E6: stay on Dashboard or Budget, otherwise go to the matching board.
    const tab = tabFromPathname(pathname);
    if (tab !== "dashboard" && tab !== "budget") {
      const target = form.type === "Out" ? "expenses" : "income";
      if (tab !== target) router.push(monthHref(monthKey, target));
    }
    const saved = await pending;
    toast(saved.ok ? (isEdit ? "Item updated" : "Item added") : "Something went wrong, try again");
  };

  const labelId = `${ids}-label`;
  const categoryId = `${ids}-category`;
  const newCategoryId = `${ids}-new-category`;
  const amountId = `${ids}-amount`;
  const noteId = `${ids}-note`;
  const categoryError = errors.category ?? null;
  const sectionId = `${ids}-section`;
  const sectionLines = getSection(form.sectionId)?.lines ?? [];

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Edit item" : form.type === "Out" ? "Add expense" : "Add income"}
      submitLabel="Save"
      onSubmit={() => void submit()}
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Type" className="grid grid-cols-2 gap-2">
          {(["Out", "In"] as const).map((t) => {
            const active = form.type === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => pickType(t)}
                className={cn(
                  "rounded-cf-input border-[1.5px] p-[9px] text-[13px] font-extrabold transition-[background-color,border-color] duration-120",
                  active && t === "Out" && "border-cf-out-toggle bg-cf-out-toggle text-white",
                  active && t === "In" && "border-cf-in-toggle bg-cf-in-toggle text-white",
                  !active && "border-cf-line-strong bg-cf-surface text-cf-ink-soft hover:bg-cf-bg",
                )}
              >
                {t === "Out" ? "Out · Expense" : "In · Income"}
              </button>
            );
          })}
        </div>

        <Field label="Item / merchant / source" htmlFor={labelId} error={errors.label}>
          <Input
            id={labelId}
            placeholder="e.g. Uniqlo, Shopee, Work"
            value={form.label}
            onChange={(e) => set({ label: e.target.value })}
            onBlur={onLabelBlur}
            aria-invalid={!!errors.label}
            aria-describedby={describedBy(labelId, errors.label)}
            autoComplete="off"
          />
        </Field>

        {form.type === "Out" ? (
          <>
            <Field label="Section" htmlFor={sectionId} error={errors.section}>
              <Select
                id={sectionId}
                value={form.sectionId}
                onChange={(e) => set({ sectionId: e.target.value, lineId: "", categoryTouched: true })}
                aria-invalid={!!errors.section}
              >
                <option value="">Choose a section…</option>
                {PLAN.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Category"
              htmlFor={categoryId}
              error={categoryError}
              labelAction={
                <Button variant="soft" size="xs" onClick={() => void runSuggest()} disabled={busy}>
                  {busy ? "Thinking…" : "✦ Suggest"}
                </Button>
              }
            >
              <Select
                id={categoryId}
                value={form.lineId}
                disabled={!form.sectionId}
                onChange={(e) => set({ lineId: e.target.value, categoryTouched: true })}
                aria-invalid={!!categoryError}
              >
                <option value="">{form.sectionId ? "Choose a category…" : "Choose a section first"}</option>
                {sectionLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
        <Field
          label="Category"
          htmlFor={categoryId}
          error={form.category === NEW_CATEGORY ? null : categoryError}
          labelAction={
            <Button variant="soft" size="xs" onClick={() => void runSuggest()} disabled={busy}>
              {busy ? "Thinking…" : "✦ Suggest"}
            </Button>
          }
        >
          <Select
            id={categoryId}
            value={form.category}
            onChange={(e) => set({ category: e.target.value, categoryTouched: true })}
            aria-invalid={form.category !== NEW_CATEGORY && !!categoryError}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </Select>
        </Field>

        {form.category === NEW_CATEGORY ? (
          <div className="flex flex-col gap-[5px]">
            <Input
              id={newCategoryId}
              surface="white"
              aria-label="New category name"
              placeholder="New category name"
              value={form.newCategory}
              onChange={(e) => set({ newCategory: e.target.value })}
              aria-invalid={!!categoryError}
              aria-describedby={describedBy(newCategoryId, categoryError)}
            />
            {categoryError ? (
              <span id={`${newCategoryId}-error`} className="text-[11px] font-bold text-cf-invalid-text">
                {categoryError}
              </span>
            ) : null}
          </div>
        ) : null}

          </>
        )}

        <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
          <Field label={`Amount (${currency.sym})`} htmlFor={amountId} error={errors.amount}>
            <Input
              id={amountId}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              weight="bold"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              aria-invalid={!!errors.amount}
              aria-describedby={describedBy(amountId, errors.amount)}
            />
          </Field>
          <Field label="Note (optional)" htmlFor={noteId} error={errors.note}>
            <Input
              id={noteId}
              placeholder="e.g. Monthly rent"
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              aria-invalid={!!errors.note}
              aria-describedby={describedBy(noteId, errors.note)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
