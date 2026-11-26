import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons (DESIGN_SYSTEM §7.1, states §9). Feature code never restyles a button;
 * add a variant here instead. `buttonVariants` can style a <Link> the same way.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-cf-pill font-body font-extrabold",
    "transition-[background-color,transform,border-color,box-shadow] duration-120 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
    "no-underline [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** Solid pink candy with 3D shadow. One per surface. */
        primary:
          "bg-cf-primary text-white shadow-cf-btn not-disabled:hover:bg-cf-primary-hover not-disabled:hover:-translate-y-px not-disabled:active:translate-y-0.5 not-disabled:active:shadow-cf-btn-pressed",
        /** AI actions: Generate/Refresh, ✦ Suggest, Read it. */
        soft: "bg-cf-soft text-cf-primary-deep not-disabled:hover:bg-cf-soft-hover not-disabled:active:bg-cf-line-strong",
        /** + Month, + Category, Fill with…, Export CSV. */
        outline:
          "border-[1.5px] border-cf-line-strong bg-cf-surface font-bold text-cf-ink not-disabled:hover:bg-cf-peach-hover not-disabled:active:bg-cf-out-tint",
        /** Reset to sample data. */
        dangerSoft:
          "border-[1.5px] border-cf-line-danger bg-cf-soft font-bold text-cf-primary-deep not-disabled:hover:bg-cf-soft-hover not-disabled:active:bg-cf-line-strong",
        /** Cancel, Discard. */
        neutral: "bg-cf-track text-cf-ink not-disabled:hover:bg-cf-cancel-hover not-disabled:active:bg-cf-line-strong",
        /** Clear, Delete (item). */
        ghost: "bg-transparent text-cf-ink-muted not-disabled:hover:bg-cf-track not-disabled:active:bg-cf-cancel-hover",
        /** Edit (item), Hide/Show. */
        text: "bg-transparent text-cf-primary not-disabled:hover:bg-cf-soft not-disabled:active:bg-cf-soft-hover",
        /** "Expenses board →". */
        roleOut: "bg-cf-out-tint text-cf-out-tag not-disabled:hover:bg-cf-out-tint-hover",
        /** "Income board →". */
        roleIn: "bg-cf-in-tint text-cf-in-tag not-disabled:hover:bg-cf-in-tint-hover",
        /** Rename / delete column icon buttons. Always pass aria-label. */
        icon: "rounded-cf-xs bg-transparent p-1 text-cf-ink-muted not-disabled:hover:bg-cf-surface not-disabled:active:bg-cf-track",
      },
      size: {
        /** padding 9px 16px, 13px. */
        lg: "px-4 py-[9px] text-[13px]",
        /** padding 8px 12px, 13px. */
        md: "px-3 py-2 text-[13px]",
        /** padding 6px 12px, 12px. */
        sm: "px-3 py-1.5 text-xs",
        /** 44px phone hit target (CLAUDE.md §10), 13px. Welcome page actions. */
        touch: "min-h-11 px-5 py-2.5 text-[13px]",
        /** padding 3px 8px, 11px. */
        xs: "px-2 py-[3px] text-[11px]",
        /** For variant="icon". */
        icon: "",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "text", size: "xs", className: "rounded-cf-xs" },
      { variant: "ghost", size: "xs", className: "rounded-cf-xs" },
    ],
    defaultVariants: { variant: "primary", size: "lg", block: false },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
