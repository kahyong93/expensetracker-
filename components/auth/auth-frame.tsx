import type { ReactNode } from "react";
import { LogoTile } from "@/components/header/logo-tile";

/**
 * Signed-out screens (welcome, /sign-in, /sign-up): dot-paper ground, centred brand
 * (logo tile, wordmark, subtitle) above the content. Works at 390px and up.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cf-paper px-3 py-10 sm:px-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoTile />
        <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-semibold text-cf-primary">
          Personal Cashflow Tracker
        </h1>
        <p className="m-0 text-xs text-cf-ink-muted">Money in, money out, and next month&apos;s plan</p>
      </div>
      {children}
    </main>
  );
}
