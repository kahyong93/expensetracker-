import { cn } from "@/lib/utils";

/**
 * Expense donut (DESIGN_SYSTEM §6): 156px conic-gradient of category shares with a
 * white 104px centre showing "Total out" and the amount. Track fill when nothing was spent.
 * The category rows next to it carry the same numbers as text.
 */
type DonutProps = {
  /** CSS conic-gradient from donutGradient(), or null when nothing was spent. */
  gradient: string | null;
  totalLabel: string;
};

export function Donut({ gradient, totalLabel }: DonutProps) {
  return (
    <div
      role="img"
      aria-label={`Expense share by category. Total out ${totalLabel}`}
      className={cn("grid size-[156px] flex-none place-items-center rounded-full", !gradient && "bg-cf-track")}
      style={gradient ? { background: gradient } : undefined}
    >
      <div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-cf-surface">
        <span className="text-[11px] font-extrabold text-cf-ink-muted">Total out</span>
        <span className="font-heading text-base font-semibold">{totalLabel}</span>
      </div>
    </div>
  );
}
