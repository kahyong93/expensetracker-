import { ProgressBar } from "@/components/ui/progress-bar";

/**
 * Ranked row (DESIGN_SYSTEM §7.5): 22px rank badge, label (ellipsis), muted meta,
 * amount, and a 5px sparkle bar scaled to the #1 item.
 */
type RankedRowProps = {
  rank: number;
  label: string;
  meta: string;
  amount: string;
  barPct: number;
};

export function RankedRow({ rank, label, meta, amount, barPct }: RankedRowProps) {
  return (
    <li className="flex flex-col gap-[5px] py-1.5">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-[22px] flex-none place-items-center rounded-cf-xs bg-cf-track text-[11px] font-extrabold"
          >
            {rank}
          </span>
          <span className="truncate font-extrabold">{label}</span>
          <span className="text-xs whitespace-nowrap text-cf-ink-muted">{meta}</span>
        </span>
        <span className="font-extrabold whitespace-nowrap">{amount}</span>
      </div>
      <ProgressBar value={barPct} height={5} fill="sparkle" />
    </li>
  );
}
