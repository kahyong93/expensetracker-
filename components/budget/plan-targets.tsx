"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CARRY_MODES, PLAN, type CarryMode, type SectionId, type Split } from "@/lib/plan";
import type { PlanPrefs } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARRY_LABELS: Record<CarryMode, string> = { off: "Off", last: "Last month only", cum: "Cumulative" };

/** Reference carryHint, minus the "Carrying from …" part that needs the carry calculation. */
const CARRY_HINTS: Record<CarryMode, string> = {
  off: "Each month starts fresh. Nothing is carried over.",
  last: "Only last month's unused budget is added.",
  cum: "Unused budget from every earlier month of the year keeps adding up, and resets each January.",
};

type PlanTargetsProps = {
  split: Split;
  carryMode: CarryMode;
  isPhone: boolean;
  onSave: (prefs: PlanPrefs) => void;
};

/** "Adds up to 100%" line under the split inputs (reference splitTotalLine). */
export function splitTotalLine(split: Split): { text: string; ok: boolean } {
  const total = PLAN.reduce((acc, s) => acc + split[s.id], 0);
  if (total === 100) return { text: "Adds up to 100%", ok: true };
  const gap = Math.abs(total - 100);
  return { text: `Adds up to ${total}% · ${total > 100 ? "take off" : "add"} ${gap}% to reach 100%`, ok: false };
}

/**
 * Split targets (% of expected income per section) and how unused budget carries over.
 * Split inputs keep the raw string while typing and save on blur or Enter (CLAUDE.md §8).
 */
export function PlanTargets({ split, carryMode, isPhone, onSave }: PlanTargetsProps) {
  const ids = useId();
  const [drafts, setDrafts] = useState<Partial<Record<SectionId, string>>>({});
  const live: Split = { ...split };
  for (const sec of PLAN) {
    const draft = drafts[sec.id];
    const n = draft === undefined ? NaN : Number(draft);
    if (draft !== undefined && Number.isInteger(n) && n >= 0 && n <= 100) live[sec.id] = n;
  }
  const total = splitTotalLine(live);

  function commit(id: SectionId) {
    const draft = drafts[id];
    if (draft === undefined) return;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 100 && n !== split[id]) {
      onSave({ split: { ...split, [id]: n }, carryMode });
    }
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, id: SectionId) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(id);
    }
  }

  return (
    <Card className="flex-row flex-wrap gap-x-8 gap-y-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold text-cf-ink-muted">Split targets (% of income)</span>
        <div className="flex flex-wrap gap-2">
          {PLAN.map((sec) => {
            const inputId = `${ids}-${sec.id}`;
            return (
              <label key={sec.id} htmlFor={inputId} className="flex flex-col gap-[3px] text-[11px] font-extrabold" style={{ color: sec.fg }}>
                {sec.title}
                <span className="flex items-center gap-1">
                  <Input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    step="1"
                    size="sm"
                    weight="bold"
                    value={drafts[sec.id] ?? String(split[sec.id])}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [sec.id]: event.target.value }))}
                    onBlur={() => commit(sec.id)}
                    onKeyDown={(event) => onKeyDown(event, sec.id)}
                    className={cn("w-16", isPhone && "min-h-11")}
                    style={{ background: sec.tint, borderColor: sec.bd }}
                  />
                  <span aria-hidden="true" className="text-[13px] text-cf-ink-muted">
                    %
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <span className={cn("text-xs font-extrabold", total.ok ? "text-cf-in-tag" : "text-cf-out-tag")}>{total.text}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold text-cf-ink-muted">Unused budget from previous months</span>
        <SegmentedControl
          aria-label="Carry-over of unused budget"
          value={carryMode}
          onChange={(mode) => onSave({ split, carryMode: mode })}
          options={CARRY_MODES.map((m) => ({ value: m, label: CARRY_LABELS[m] }))}
          className="self-start"
        />
        <span className="max-w-[340px] text-xs text-pretty text-cf-ink-muted">{CARRY_HINTS[carryMode]}</span>
      </div>
    </Card>
  );
}
