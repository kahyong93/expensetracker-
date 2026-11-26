import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

/**
 * Phone KPI strip (DESIGN_SYSTEM §7.4): one white card with three role tiles
 * (Earned, Spent, Left), then the saving bar with "x% saved" and the kaomoji.
 */
type KpiStripProps = {
  earned: string;
  spent: string;
  left: string;
  savingBarPct: number;
  overspent: boolean;
  savedLabel: string;
  mood: string;
};

const TILES = [
  { key: "earned", label: "Earned", fill: "bg-cf-in-fill", ink: "text-cf-in-num" },
  { key: "spent", label: "Spent", fill: "bg-cf-out-fill", ink: "text-cf-out-num" },
  { key: "left", label: "Left", fill: "bg-cf-bal-fill", ink: "text-cf-bal-num" },
] as const;

export function KpiStrip({ earned, spent, left, savingBarPct, overspent, savedLabel, mood }: KpiStripProps) {
  const amounts = { earned, spent, left };
  return (
    <section
      aria-label="Month totals"
      className="flex flex-col gap-2.5 rounded-cf-card-sm border-2 border-cf-line bg-cf-surface p-3 shadow-cf-strip"
    >
      <div className="grid grid-cols-3 gap-1.5">
        {TILES.map((t) => (
          <div key={t.key} className={cn("flex min-w-0 flex-col gap-1 rounded-cf-tile p-2.5", t.fill)}>
            <span className={cn("text-[11px] font-extrabold", t.ink)}>{t.label}</span>
            <span
              className={cn(
                "truncate font-heading text-[17px] leading-[1.1] font-semibold whitespace-nowrap",
                t.ink,
              )}
            >
              {amounts[t.key]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar value={savingBarPct} height={8} fill={overspent ? "overspent" : "saving"} className="flex-1" />
        <span className="text-xs font-extrabold whitespace-nowrap text-cf-bal-tag">
          {savedLabel} <span aria-hidden="true">{mood}</span>
        </span>
      </div>
    </section>
  );
}
