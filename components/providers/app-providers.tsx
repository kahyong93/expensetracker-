"use client";

import type { ReactNode } from "react";
import { EntryModalProvider } from "@/components/entry/entry-modal-provider";
import { LayoutModeProvider } from "@/components/providers/layout-mode-provider";
import { ConfirmProvider } from "@/components/ui/confirm";
import { ToastProvider } from "@/components/ui/toast";

/** Client providers for the signed-in app: layout mode, toast, confirm, add/edit item. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LayoutModeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <EntryModalProvider>{children}</EntryModalProvider>
        </ConfirmProvider>
      </ToastProvider>
    </LayoutModeProvider>
  );
}
