"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { buildMonthCsv, csvFileName } from "@/lib/csv";
import { useMonthView, useMutate } from "@/components/providers/cashflow-data-provider";
import { monthHref } from "@/lib/months";
import { loadSampleAction } from "@/server/actions/months";

/** Footer: Export CSV and Reset to sample data (PRD G8, X1, X2; DESIGN_SYSTEM §7.12). */
export function AppFooter() {
  const view = useMonthView();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const mutate = useMutate();

  if (view.status !== "ready") return null;

  const exportCsv = () => {
    const { month, currency, nextKey, nextPlan } = view;
    const csv = buildMonthCsv(month, currency, { key: nextKey, budgets: nextPlan.lines });
    const file = csvFileName(month.key);
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${file}`);
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Reset to the Jan-25 sheet?",
      text: "This restores all 66 expense items and 7 income items to their original categories. Your budgets, AI budget note, split targets and carry-over setting go back to the defaults.",
      ok: "Reset",
    });
    if (!ok) return;
    const res = await mutate(null, () => loadSampleAction());
    if (!res.ok) {
      toast(res.message);
      return;
    }
    toast("Restored Jan-25 data");
    router.push(monthHref(res.data.key));
  };

  return (
    <footer className="flex flex-wrap justify-end gap-2 pt-2">
      <Button variant="outline" size="sm" className="py-[7px]" onClick={exportCsv}>
        Export CSV
      </Button>
      <Button variant="dangerSoft" size="sm" className="py-[7px]" onClick={() => void reset()}>
        Reset to sample data
      </Button>
    </footer>
  );
}
