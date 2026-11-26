"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEntryModal } from "@/components/entry/entry-modal-provider";
import { useMonthView } from "@/components/providers/cashflow-data-provider";
import { AppHeader } from "@/components/header/app-header";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { AppFooter } from "@/components/shell/app-footer";
import { Fab } from "@/components/ui/fab";
import { tabFromPathname } from "@/lib/months";
import { cn } from "@/lib/utils";

/**
 * App frame: header, main (with footer) and the phone FAB. When the phone layout is
 * forced on a wide screen, the whole app renders inside a 430px frame (DESIGN_SYSTEM §8.3).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { isPhone, framed } = useLayoutMode();
  const { openAdd } = useEntryModal();
  const pathname = usePathname();
  const view = useMonthView();

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-cf-paper",
        framed && "mx-auto w-full max-w-[430px] shadow-cf-frame",
      )}
    >
      <AppHeader />
      <main
        id="main"
        className={cn(
          "mx-auto box-border flex w-full max-w-[1240px] flex-1 flex-col gap-5",
          isPhone ? "px-3 pt-3.5 pb-[100px]" : "p-6",
        )}
      >
        {children}
        <AppFooter />
      </main>
      {isPhone && view.status === "ready" ? (
        <Fab
          aria-label="Add item"
          onClick={() => openAdd({ type: tabFromPathname(pathname) === "income" ? "In" : "Out" })}
        />
      ) : null}
    </div>
  );
}
