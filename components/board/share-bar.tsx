import type { CategoryStat } from "@/lib/calc";
import { formatPct } from "@/lib/calc";

/**
 * Stacked share bar and legend (PRD B3, DESIGN_SYSTEM §7.5): a 12px pill with a 2px gap
 * between segments, plus a wrapping legend (dot, name, bold %). The bar is decorative;
 * the legend carries the numbers for screen readers.
 */
export function ShareBar({ stats, decimals }: { stats: readonly CategoryStat[]; decimals: number }) {
  return (
    <section
      aria-label="Share by category"
      className="flex flex-col gap-2.5 rounded-cf-card-sm border-[1.5px] border-cf-line bg-cf-surface px-[18px] py-4"
    >
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-cf-pill bg-cf-track">
        {stats
          .filter((s) => s.sharePct > 0)
          .map((s) => (
            <div key={s.name} className="h-full" style={{ width: `${s.sharePct}%`, background: s.color }} />
          ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-3.5 p-0 text-xs">
        {stats.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-[9px] shrink-0 rounded-full" style={{ background: s.color }} />
            {s.name} <b>{formatPct(s.sharePct, decimals)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
