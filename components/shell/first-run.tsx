"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { monthHref } from "@/lib/months";
import type { ActionResult } from "@/lib/types";
import { loadSampleAction, startFreshAction } from "@/server/actions/months";

type Choice = "fresh" | "sample";

/**
 * First run (PRD A3): a signed-in user with no months picks "Start fresh" (the current
 * month with the default categories, A4) or "Try with sample data" (the Jan-25 sample).
 */
export function FirstRun() {
  const router = useRouter();
  const [busy, setBusy] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(choice: Choice) {
    if (busy) return;
    setBusy(choice);
    setError(null);
    let res: ActionResult<{ key: string }>;
    try {
      res = choice === "fresh" ? await startFreshAction() : await loadSampleAction();
    } catch {
      res = { ok: false, code: "network", message: "Something went wrong, try again" };
    }
    if (!res.ok) {
      setError(res.message);
      setBusy(null);
      return;
    }
    router.push(monthHref(res.data.key));
  }

  return (
    <AuthFrame>
      <Card className="w-full max-w-[420px] items-center text-center" aria-busy={busy != null}>
        <p className="m-0 text-sm text-cf-ink-soft">How would you like to start?</p>
        <div className="flex w-full flex-col gap-2.5">
          <Button variant="primary" size="touch" block disabled={busy != null} onClick={() => void choose("fresh")}>
            {busy === "fresh" ? "Setting up…" : "Start fresh"}
          </Button>
          <Button variant="outline" size="touch" block disabled={busy != null} onClick={() => void choose("sample")}>
            {busy === "sample" ? "Loading…" : "Try with sample data"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="m-0 text-xs font-bold text-cf-invalid-text">
            {error}
          </p>
        ) : null}
      </Card>
    </AuthFrame>
  );
}
