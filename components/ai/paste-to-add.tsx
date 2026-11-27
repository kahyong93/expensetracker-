"use client";

import { useId, useRef, useState } from "react";
import { ParsedRowItem } from "@/components/ai/parsed-row-item";
import { useMutate } from "@/components/providers/cashflow-data-provider";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AI_BUSY_MESSAGE, PASTE_EMPTY_MESSAGE, PASTE_MAX_CHARS, PASTE_TOO_LONG_MESSAGE } from "@/lib/ai-messages";
import type { EntryInput } from "@/lib/types";
import type { DisplayCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { parsePasteAction } from "@/server/actions/ai";
import { addEntriesAction } from "@/server/actions/entries";

type PreviewRow = EntryInput & { key: number };

type PasteToAddProps = {
  monthKey: string;
  currency: DisplayCurrency;
};

function entriesWord(count: number): string {
  return count === 1 ? "1 entry" : `${count} entries`;
}

function toEntryInput(row: PreviewRow): EntryInput {
  return { type: row.type, category: row.category, label: row.label, amountCents: row.amountCents, note: row.note };
}

/**
 * "Paste to add" (PRD AI-6). Read it → preview rows (removable) → Discard or
 * "Add {n} entries to {month}". Nothing is saved before the user confirms.
 */
export function PasteToAdd({ monthKey, currency }: PasteToAddProps) {
  const toast = useToast();
  const mutate = useMutate();
  const { isPhone } = useLayoutMode();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const nextKey = useRef(0);
  const titleId = useId();
  const explainerId = useId();

  async function read() {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) {
      toast(PASTE_EMPTY_MESSAGE);
      return;
    }
    // Checked here too (not only on the server) so an over-long paste doesn't use up an AI request.
    if (trimmed.length > PASTE_MAX_CHARS) {
      toast(PASTE_TOO_LONG_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      // The server checks every row; "No entries found in that text" comes back as an error.
      const result = await parsePasteAction(monthKey, trimmed);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      const found = result.data;
      const base = nextKey.current;
      nextKey.current += found.length;
      setRows(found.map((row, i) => ({ ...row, key: base + i })));
    } catch {
      toast(AI_BUSY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function remove(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  async function add() {
    if (rows.length === 0 || adding) return;
    setAdding(true);
    const inputs = rows.map(toEntryInput);
    const result = await mutate(null, () => addEntriesAction(monthKey, inputs));
    setAdding(false);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    toast(`Added ${entriesWord(result.data)}`);
    setRows([]);
    setText("");
  }

  const touch = isPhone && "min-h-11";

  return (
    <Card padding="ai" gap="sm" aria-labelledby={titleId}>
      <SectionTitle id={titleId}>Paste to add</SectionTitle>
      <p id={explainerId} className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        Paste a bank SMS, receipt or a quick list. AI turns it into entries for {monthKey}.
      </p>
      <Textarea
        aria-labelledby={titleId}
        aria-describedby={explainerId}
        rows={5}
        placeholder="e.g. DBS: You paid SGD 12.50 to GRAB on 03 Feb. Kopi 1.80, chicken rice 4.50"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button variant="soft" size="lg" onClick={read} disabled={busy} className={cn("self-start", touch)}>
        {busy ? "Reading…" : "Read it"}
      </Button>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t-[1.5px] border-dashed border-cf-line pt-1.5">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {rows.map((row) => (
              <ParsedRowItem key={row.key} row={row} currency={currency} onRemove={() => remove(row.key)} />
            ))}
          </ul>
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <Button variant="neutral" size="md" onClick={() => setRows([])} className={cn(touch)}>
              Discard
            </Button>
            <Button variant="primary" size="md" onClick={() => void add()} disabled={adding} className={cn(touch)}>
              Add {entriesWord(rows.length)} to {monthKey}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
