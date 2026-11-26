import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Form fields (DESIGN_SYSTEM §7.3). Inputs keep the raw string while typing;
 * convert to cents on commit with lib/money `inputToCents`.
 *
 * Usage:
 *   <Field label="Amount (S$)" htmlFor={id} error={err}>
 *     <Input id={id} aria-invalid={!!err} aria-describedby={describedBy(id, err)} />
 *   </Field>
 */

const controlVariants = cva(
  [
    "min-w-0 border-[1.5px] border-cf-line-strong font-body text-sm text-cf-ink",
    "transition-[border-color] duration-120 ease-out",
    "disabled:cursor-not-allowed disabled:opacity-55",
    "aria-invalid:border-cf-invalid-border",
  ],
  {
    variants: {
      /** `field` inside cards/modals, `white` on the page ground, `income` for the expected-income input. */
      surface: {
        field: "bg-cf-field",
        white: "bg-cf-surface",
        income: "border-cf-in-tint-hover bg-cf-in-input-fill text-cf-in-tag",
      },
      size: {
        /** padding 9px 12px, r 12. */
        md: "rounded-cf-input px-3 py-[9px]",
        /** padding 7px 10px, r 10 (budget / rate inputs). */
        sm: "rounded-cf-input-sm px-2.5 py-[7px]",
      },
      weight: {
        normal: "",
        bold: "font-extrabold",
      },
    },
    defaultVariants: { surface: "field", size: "md", weight: "normal" },
  },
);

type ControlVariantProps = VariantProps<typeof controlVariants>;

export function Input({
  className,
  surface,
  size,
  weight,
  ...props
}: Omit<ComponentProps<"input">, "size"> & ControlVariantProps) {
  return <input className={cn(controlVariants({ surface, size, weight }), className)} {...props} />;
}

export function Select({
  className,
  surface,
  size,
  weight,
  ...props
}: Omit<ComponentProps<"select">, "size"> & ControlVariantProps) {
  return <select className={cn(controlVariants({ surface, size, weight }), "pr-2.5", className)} {...props} />;
}

export function Textarea({
  className,
  surface,
  size,
  weight,
  rows = 5,
  ...props
}: ComponentProps<"textarea"> & ControlVariantProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlVariants({ surface, size, weight }), "resize-y leading-[1.45]", className)}
      {...props}
    />
  );
}

/** Header pill selects (Month, Currency): 13/800, white, pill. */
export function PillSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "rounded-cf-pill border-[1.5px] border-cf-line-strong bg-cf-surface px-2.5 py-2 text-[13px] font-extrabold text-cf-ink",
        className,
      )}
      {...props}
    />
  );
}

export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

/** aria-describedby value for a control with an optional error. */
export function describedBy(id: string, error?: string | null): string | undefined {
  return error ? fieldErrorId(id) : undefined;
}

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  error?: string | null;
  /** Content shown at the right of the label row (e.g. the ✦ Suggest button). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Stacked label (12/800 ink-soft, gap 5) + control + optional inline error (11/700). */
export function Field({ label, htmlFor, error, labelAction, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-[5px]", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-extrabold text-cf-ink-soft">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <span id={fieldErrorId(htmlFor)} className="text-[11px] font-bold text-cf-invalid-text">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Checkbox row: bg panel, r 12, padding 12, primary accent colour. */
export function CheckboxRow({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label
      className={cn("flex cursor-pointer items-start gap-2.5 rounded-cf-input bg-cf-bg p-3 text-[13px]", className)}
    >
      <input type="checkbox" className="mt-0.5 accent-cf-primary" {...props} />
      <span>{label}</span>
    </label>
  );
}
