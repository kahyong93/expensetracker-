"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";

/**
 * Confirm modal for destructive actions (CLAUDE.md §9, DESIGN_SYSTEM §7.9).
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete item?", text: `Delete "${label}" (${amt}) from ${cat}?`, ok: "Delete" })) …
 */
export type ConfirmOptions = { title: string; text: string; ok?: string };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title ?? ""}
        submitLabel={opts?.ok ?? "Confirm"}
        onSubmit={() => settle(true)}
      >
        <p className="m-0 text-sm leading-normal text-cf-ink-soft">{opts?.text}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
