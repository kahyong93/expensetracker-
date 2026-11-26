import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card (DESIGN_SYSTEM §7.4): white, 2px line border, r 30, 3D card shadow,
 * flex column. padding "md" = 22 (default), "ai" = 20, "none" for custom layouts.
 */
type CardProps = ComponentProps<"section"> & {
  padding?: "md" | "ai" | "none";
  gap?: "sm" | "md";
  /** Drop the 3D shadow (collapsible audit panel, plan table). */
  flat?: boolean;
};

export function Card({ className, padding = "md", gap = "md", flat = false, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-cf-card border-2 border-cf-line bg-cf-surface",
        !flat && "shadow-cf-card",
        padding === "md" && "p-[22px]",
        padding === "ai" && "p-5",
        gap === "md" ? "gap-4" : "gap-3",
        className,
      )}
      {...props}
    />
  );
}

/** Header row: title on the left, an action on the right, wrapping. */
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-2", className)} {...props} />;
}

/** Section title: Fredoka 21/600 prefixed by a sparkle ✦ (gap 6). Renders an h2 by default. */
export function SectionTitle({
  children,
  as: Tag = "h2",
  className,
  id,
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn("m-0 flex items-center gap-1.5 font-heading text-[21px] font-semibold", className)}>
      <span aria-hidden="true" className="text-cf-sparkle">
        ✦
      </span>
      {children}
    </Tag>
  );
}

/** Overline label: 11/800 uppercase, letter-spacing .06em, muted. */
export function Overline({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-[11px] font-extrabold tracking-[0.06em] text-cf-ink-muted uppercase", className)}
      {...props}
    />
  );
}
