"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { EntryModal, type EntryModalRequest } from "@/components/entry/entry-modal";

/**
 * Shared Add / Edit item modal (PRD §7.3, G7, B8). Any page can open it:
 *   const { openAdd, openEdit } = useEntryModal();
 *   openAdd({ type: "Out", category: "Food" });   // "+ Add to Food"
 *   openEdit(entry);                               // item card "Edit"
 */
type EntryModalApi = {
  openAdd: (opts: { type: "Out" | "In"; category?: string }) => void;
  openEdit: (entry: Extract<EntryModalRequest, { mode: "edit" }>["entry"]) => void;
};

const EntryModalContext = createContext<EntryModalApi | null>(null);

const noop = () => {};

export function EntryModalProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(EntryModalRequest & { seq: number }) | null>(null);

  const openAdd = useCallback<EntryModalApi["openAdd"]>((opts) => {
    setRequest((prev) => ({ mode: "add", type: opts.type, category: opts.category, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  const openEdit = useCallback<EntryModalApi["openEdit"]>((entry) => {
    setRequest((prev) => ({ mode: "edit", entry, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const api = useMemo(() => ({ openAdd, openEdit }), [openAdd, openEdit]);

  return (
    <EntryModalContext.Provider value={api}>
      {children}
      {/* The modal stays mounted after closing so the dialog can return focus to the trigger;
          a new request remounts it (key) with a fresh form. */}
      {request ? <EntryModal key={request.seq} request={request} onClose={noop} /> : null}
    </EntryModalContext.Provider>
  );
}

export function useEntryModal(): EntryModalApi {
  const ctx = useContext(EntryModalContext);
  if (!ctx) throw new Error("useEntryModal must be used inside <EntryModalProvider>");
  return ctx;
}
