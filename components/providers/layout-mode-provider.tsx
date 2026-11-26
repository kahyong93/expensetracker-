"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useCashflowData, useMutate } from "@/components/providers/cashflow-data-provider";
import type { LayoutPref } from "@/lib/types";
import { setLayoutAction } from "@/server/actions/settings";

/**
 * Phone vs laptop (DESIGN_SYSTEM §8, CLAUDE.md §5.5). Every phone/laptop difference
 * reads `isPhone`; never use a media query for anything the override can change.
 * The saved preference comes from the server; with "auto" the server renders the laptop
 * layout and the client resolves the width on mount. Changing it is optimistic.
 */
export type LayoutModeValue = {
  mode: LayoutPref;
  /** mode === "phone" || (mode === "auto" && width < 720). */
  isPhone: boolean;
  /** Forced phone layout on a wide screen: the app renders in a 430px frame. */
  framed: boolean;
  setMode: (mode: LayoutPref) => void;
};

const PHONE_QUERY = "(max-width: 719px)";

function subscribeNarrow(onChange: () => void): () => void {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const LayoutModeContext = createContext<LayoutModeValue | null>(null);

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const { app } = useCashflowData();
  const mutate = useMutate();
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
  const mode: LayoutPref = app.layout;
  const setMode = useCallback(
    (next: LayoutPref) => void mutate({ kind: "setLayout", layout: next }, () => setLayoutAction(next)),
    [mutate],
  );
  const value = useMemo<LayoutModeValue>(
    () => ({
      mode,
      isPhone: mode === "phone" || (mode === "auto" && narrow),
      framed: mode === "phone" && !narrow,
      setMode,
    }),
    [mode, narrow, setMode],
  );
  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode(): LayoutModeValue {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used inside <LayoutModeProvider>");
  return ctx;
}
