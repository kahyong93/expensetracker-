"use client";

import { useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckboxRow, describedBy, Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useMutate } from "@/components/providers/cashflow-data-provider";
import { useToast } from "@/components/ui/toast";
import { monthHref, nextOf, tabFromPathname } from "@/lib/months";
import { validateMonthLabel } from "@/lib/validation";
import { createMonthAction } from "@/server/actions/months";

/** "Create a new month" (PRD G4). The label defaults to the month after the active one. */
export function CreateMonthModal({
  open,
  activeKey,
  onClose,
}: {
  open: boolean;
  activeKey: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const mutate = useMutate();
  const id = useId();
  const [name, setName] = useState(() => nextOf(activeKey));
  const [copy, setCopy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const invalid = validateMonthLabel(name);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    const res = await mutate(null, () => createMonthAction(name.trim(), copy ? activeKey : null));
    setBusy(false);
    if (!res.ok) {
      setError(res.code === "exists" ? null : res.message);
      toast(res.message);
      return;
    }
    toast(`Created ${res.data.key}`);
    onClose();
    router.push(monthHref(res.data.key, tabFromPathname(pathname)));
  };

  return (
    <Modal open={open} onClose={onClose} title="Create a new month" submitLabel="Create" onSubmit={() => void submit()}>
      <div className="flex flex-col gap-3">
        <Field label="Month label" htmlFor={id} error={error}>
          <Input
            id={id}
            placeholder="e.g. Feb-25"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={describedBy(id, error)}
          />
        </Field>
        <CheckboxRow
          label="Copy recurring items (Fixed & Bills, Work salary, Interest)"
          checked={copy}
          onChange={(e) => setCopy(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
