import { cn } from "@/lib/utils";

/**
 * Progress bar (DESIGN_SYSTEM §7.5): pill track with a pill fill at `value`% width.
 * Decorative (aria-hidden) unless `label` is given, because the number is always shown
 * as text next to it.
 *
 * Heights per §4: 12 (stacked share), 10 (KPI saving), 8 (phone saving), 7 (category),
 * 6 (budget), 5 (merchant).
 */
export type ProgressFill =
  | "under" // within budget, mint
  | "over" // over budget, orange
  | "saving" // KPI saving bar
  | "overspent" // KPI saving bar when spent > earned
  | "in" // income category bar
  | "sparkle" // merchant / ranked bars
  | "neutral"; // "this month actual" in the budget planner

const FILL_CLASS: Record<ProgressFill, string> = {
  under: "bg-cf-under-budget",
  over: "bg-cf-over-budget",
  saving: "bg-cf-saving-bar",
  overspent: "bg-cf-overspent-bar",
  in: "bg-cf-in-bar",
  sparkle: "bg-cf-sparkle",
  neutral: "bg-cf-neutral-bar",
};

const TRACK_CLASS = {
  track: "bg-cf-track",
  white: "bg-cf-surface",
  in: "bg-cf-in-tint",
} as const;

type ProgressBarProps = {
  /** 0–100; clamped. */
  value: number;
  height: 5 | 6 | 7 | 8 | 10 | 12;
  /** A named fill, or a raw category colour from lib/design/palette. */
  fill: ProgressFill | { color: string };
  track?: keyof typeof TRACK_CLASS;
  /** Accessible name; when set the bar is exposed as role="progressbar". */
  label?: string;
  className?: string;
};

const HEIGHT_CLASS = { 5: "h-[5px]", 6: "h-1.5", 7: "h-[7px]", 8: "h-2", 10: "h-2.5", 12: "h-3" } as const;

export function ProgressBar({ value, height, fill, track = "track", label, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const a11y = label
    ? { role: "progressbar" as const, "aria-label": label, "aria-valuenow": Math.round(pct), "aria-valuemin": 0, "aria-valuemax": 100 }
    : { "aria-hidden": true as const };
  return (
    <div className={cn("overflow-hidden rounded-cf-pill", HEIGHT_CLASS[height], TRACK_CLASS[track], className)} {...a11y}>
      <div
        className={cn("h-full rounded-cf-pill", typeof fill === "string" && FILL_CLASS[fill])}
        style={{ width: `${pct}%`, ...(typeof fill === "object" ? { background: fill.color } : null) }}
      />
    </div>
  );
}
