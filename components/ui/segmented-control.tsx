"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control (DESIGN_SYSTEM §7.2): track-coloured pill ground, white active
 * option with primary text. Options are toggle buttons (aria-pressed) in a labelled group.
 * Used for the layout toggle and Merchants / Biggest 10. The main nav has its own links.
 */
export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is icon-only. */
  ariaLabel?: string;
  title?: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={rest["aria-label"]}
      className={cn("flex gap-0.5 rounded-cf-pill bg-cf-track p-[3px]", size === "md" && "gap-1 p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.ariaLabel}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center justify-center gap-[5px] rounded-cf-pill text-xs font-extrabold whitespace-nowrap",
              "transition-[background-color,color] duration-120 ease-out",
              size === "sm" ? "px-2.5 py-1.5" : "px-3 py-1.5",
              active ? "bg-cf-surface text-cf-primary" : "bg-transparent text-cf-ink-muted hover:text-cf-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
