"use client";

import { useState } from "react";
import { useCashflowData, useMutate } from "@/components/providers/cashflow-data-provider";
import { CheckboxRow } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Settings } from "@/lib/types";
import { updateSettingsAction } from "@/server/actions/settings";

/** Setting labels, word for word from PRD §7.8. */
const SETTING_LABELS: { key: keyof Settings; label: string }[] = [
  { key: "autoCategorise", label: "Auto-categorise on item name blur" },
  { key: "compactCards", label: "Compact item cards (hide notes on boards)" },
  { key: "showAudit", label: "Show sample audit panel" },
];

/**
 * Settings (PRD §7.8 S3–S5; entry point per PRD §14 Q1: a small icon button after the
 * currency select, opening a modal). Currency and layout stay in the header. Changes are
 * buffered and saved together on Save.
 */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { app } = useCashflowData();
  const mutate = useMutate();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings>(app.settings);

  const submit = async () => {
    const patch: Partial<Settings> = {};
    for (const { key } of SETTING_LABELS) if (draft[key] !== app.settings[key]) patch[key] = draft[key];
    onClose();
    if (Object.keys(patch).length === 0) return;
    const res = await mutate({ kind: "setSettings", settings: patch }, () => updateSettingsAction(patch));
    toast(res.ok ? "Settings saved" : res.message);
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings" submitLabel="Save" onSubmit={() => void submit()}>
      <div className="flex flex-col gap-2">
        {SETTING_LABELS.map(({ key, label }) => (
          <CheckboxRow
            key={key}
            label={label}
            checked={draft[key]}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
          />
        ))}
      </div>
    </Modal>
  );
}
