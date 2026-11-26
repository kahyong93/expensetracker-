"use client";

import { LogoTile } from "@/components/header/logo-tile";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";

/** Logo tile, wordmark and subtitle (PRD G1). The subtitle is hidden on phone. */
export function Brand() {
  const { isPhone } = useLayoutMode();
  return (
    <div className="flex items-center gap-3">
      <LogoTile />
      <div className="flex flex-col">
        <span className="font-heading text-[22px] leading-[1.1] font-semibold text-cf-primary">
          Personal Cashflow Tracker
        </span>
        {isPhone ? null : <span className="text-xs text-cf-ink-muted">Money in, money out, and next month&apos;s plan</span>}
      </div>
    </div>
  );
}
