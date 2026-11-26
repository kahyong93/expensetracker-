"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { cn } from "@/lib/utils";

/**
 * Toast (DESIGN_SYSTEM §7.10). `const toast = useToast(); toast("Item added")`.
 * Auto-hides after 2600ms; a new toast replaces the current one. The live region is
 * always mounted so screen readers announce each message.
 */
export const TOAST_MS = 2600;

const ToastContext = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { isPhone, framed } = useLayoutMode();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }));
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed z-60",
          isPhone ? "bottom-24" : "bottom-5",
          framed ? "right-[calc(50%-199px)] max-w-[398px]" : "right-4 max-w-[calc(100%-32px)]",
        )}
      >
        {toast ? (
          <div
            key={toast.id}
            className="rounded-cf-pill bg-cf-primary px-5 py-3 text-[13px] leading-[1.35] font-extrabold whitespace-normal text-white shadow-cf-toast"
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
