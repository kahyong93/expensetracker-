import type { ReactNode } from "react";

/** Muted helper text for an empty dashboard section (DESIGN_SYSTEM §9 "Empty"). */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">{children}</p>;
}
