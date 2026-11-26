import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Role link to a board ("Expenses board →" peach, "Income board →" mint). On phone an
 * invisible pseudo-element stretches the hit target to 44px without changing the look.
 */
type BoardLinkProps = {
  href: string;
  type: "Out" | "In";
  isPhone: boolean;
};

export function BoardLink({ href, type, isPhone }: BoardLinkProps) {
  const out = type === "Out";
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: out ? "roleOut" : "roleIn", size: "sm" }),
        "no-underline",
        out ? "hover:bg-cf-out-tint-hover hover:text-cf-out-tag" : "hover:bg-cf-in-tint-hover hover:text-cf-in-tag",
        isPhone && "relative before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
      )}
    >
      {out ? "Expenses board" : "Income board"} <span aria-hidden="true">→</span>
    </Link>
  );
}
