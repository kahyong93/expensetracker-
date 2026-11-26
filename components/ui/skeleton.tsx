import { cn } from "@/lib/utils";

/**
 * Loading skeleton (DESIGN_SYSTEM §9): blocks in the final shapes filled with the track
 * colour and a soft 1.2s opacity pulse. No spinners. Size it with className
 * (e.g. "h-40 rounded-cf-card" for a card, "h-[7px] rounded-cf-pill" for a bar).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-cf-pulse bg-cf-track", className)} />;
}

/** Screen-reader text for a loading region. Pair with skeleton blocks. */
export function LoadingStatus({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}
