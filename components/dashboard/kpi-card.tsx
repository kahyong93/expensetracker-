import type { ReactNode } from "react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

/**
 * Laptop KPI card (DESIGN_SYSTEM §7.4): role fill and border, r 30, padding 22,
 * 3D role shadow and the decorative white bubble. `aside` sits right of the tag
 * (mascot or kaomoji); `footer` is the sub line or the saving bar.
 */
export type KpiRole = "in" | "out" | "bal";

const ROLE_CLASS: Record<KpiRole, { card: string; tag: string; numeral: string }> = {
  in: { card: "bg-cf-in-fill border-cf-in-border shadow-cf-kpi-in", tag: "text-cf-in-tag", numeral: "text-cf-in-num" },
  out: {
    card: "bg-cf-out-fill border-cf-out-border shadow-cf-kpi-out",
    tag: "text-cf-out-tag",
    numeral: "text-cf-out-num",
  },
  bal: {
    card: "bg-cf-bal-fill border-cf-bal-border shadow-cf-kpi-bal",
    tag: "text-cf-bal-tag",
    numeral: "text-cf-bal-num",
  },
};

type KpiCardProps = {
  role: KpiRole;
  tag: string;
  amount: string;
  aside: ReactNode;
  footer: ReactNode;
};

export function KpiCard({ role, tag, amount, aside, footer }: KpiCardProps) {
  const c = ROLE_CLASS[role];
  return (
    <div className={cn("relative flex flex-col gap-2 overflow-hidden rounded-cf-card border-2 p-[22px]", c.card)}>
      <span
        aria-hidden="true"
        className="absolute -right-[34px] -bottom-[46px] size-[130px] rounded-full bg-cf-surface/45"
      />
      <div className="relative flex items-center justify-between gap-2">
        <Tag tone="white" size="kpi" className={c.tag}>
          {tag}
        </Tag>
        {aside}
      </div>
      <span className={cn("relative font-heading text-4xl leading-[1.1] font-semibold", c.numeral)}>{amount}</span>
      <div className="relative">{footer}</div>
    </div>
  );
}
