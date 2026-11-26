"use client";

import { useId, useState } from "react";
import { BOARD_COPY } from "@/components/board/board-copy";
import { describedBy, Field, Input } from "@/components/ui/field";
import { useMutate } from "@/components/providers/cashflow-data-provider";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { EntryType } from "@/lib/types";
import { validateCategoryName } from "@/lib/validation";
import { addCategoryAction, renameCategoryAction } from "@/server/actions/categories";

export type CategoryModalRequest = { kind: "new" } | { kind: "rename"; oldName: string };

/**
 * New / Rename category modal (PRD B9, B10). Remount with a new `key` per request so the
 * form resets; keep it mounted with open=false after closing so focus returns to the trigger.
 */
export function CategoryNameModal({
  open,
  request,
  type,
  monthKey,
  onClose,
  onRenamed,
}: {
  open: boolean;
  request: CategoryModalRequest;
  type: EntryType;
  monthKey: string;
  onClose: () => void;
  onRenamed: (oldName: string, newName: string) => void;
}) {
  const toast = useToast();
  const mutate = useMutate();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(request.kind === "rename" ? request.oldName : "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const invalid = validateCategoryName(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    const trimmed = name.trim();

    if (request.kind === "new") {
      setBusy(true);
      const res = await mutate(null, () => addCategoryAction(monthKey, type, trimmed));
      setBusy(false);
      if (!res.ok) {
        toast(BOARD_COPY.error);
        return;
      }
      // B9: a duplicate name in the same board is ignored (the column already exists).
      if (res.data.created) toast(BOARD_COPY.added(trimmed));
      onClose();
      return;
    }

    if (trimmed === request.oldName) {
      onClose();
      return;
    }
    setBusy(true);
    const res = await mutate(null, () => renameCategoryAction(monthKey, type, request.oldName, trimmed));
    setBusy(false);
    if (!res.ok) {
      if (res.code === "duplicate" || res.code === "invalid") setError(res.message);
      else toast(BOARD_COPY.error);
      return;
    }
    toast(BOARD_COPY.renamed(trimmed));
    onRenamed(request.oldName, trimmed);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={request.kind === "rename" ? BOARD_COPY.renameTitle : BOARD_COPY.newCategoryTitle(type)}
      submitLabel={BOARD_COPY.save}
      onSubmit={() => void submit()}
    >
      <Field label={BOARD_COPY.categoryNameLabel} htmlFor={id} error={error}>
        <Input
          id={id}
          placeholder={BOARD_COPY.categoryNamePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={describedBy(id, error)}
          autoComplete="off"
        />
      </Field>
    </Modal>
  );
}
