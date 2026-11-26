import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Tag / chip (DESIGN_SYSTEM §7.5): pill, 11/700–800. For category tints pass the
 * palette tint via `style={{ background: tint }}` with tone="plain".
 */
const tagVariants = cva("inline-flex items-center rounded-cf-pill whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-cf-track text-cf-ink-soft",
      white: "bg-cf-surface text-cf-ink-muted",
      out: "bg-cf-out-tint text-cf-out-tag",
      in: "bg-cf-in-tint text-cf-in-tag",
      bal: "bg-cf-bal-tint text-cf-bal-tag",
      plain: "text-cf-ink",
    },
    size: {
      /** padding 1px 7px, 11px. */
      sm: "px-[7px] py-px text-[11px] font-bold",
      /** padding 2px 8px, 12px (board column % pill). */
      md: "px-2 py-0.5 text-xs font-extrabold",
      /** padding 4px 12px, 12/800 (KPI card tags). */
      kpi: "px-3 py-1 text-xs font-extrabold",
    },
  },
  defaultVariants: { tone: "neutral", size: "sm" },
});

export function Tag({
  className,
  tone,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span className={cn(tagVariants({ tone, size }), className)} {...props} />;
}
