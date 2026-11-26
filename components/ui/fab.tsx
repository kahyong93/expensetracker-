"use client";

import type { ComponentProps } from "react";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";
import { cn } from "@/lib/utils";

/** Floating action button (DESIGN_SYSTEM §7.1). Phone only: render it when isPhone. */
export function Fab({ className, ...props }: Omit<ComponentProps<"button">, "children">) {
  const { framed } = useLayoutMode();
  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-6 z-41 grid size-[58px] place-items-center rounded-full bg-cf-primary font-heading text-[32px] leading-none text-white shadow-cf-fab",
        "transition-[transform,box-shadow] duration-120 ease-out active:translate-y-0.5 active:shadow-cf-fab-pressed",
        framed ? "right-[calc(50%-197px)]" : "right-[18px]",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">+</span>
    </button>
  );
}
