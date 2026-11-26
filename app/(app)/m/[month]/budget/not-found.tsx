import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function BudgetNotFound() {
  return (
    <Card className="items-start">
      <h1 className="m-0 font-heading text-[21px] font-semibold">We couldn&apos;t find that page</h1>
      <p className="m-0 text-[13px] text-pretty text-cf-ink-muted">
        Pick a month from the header, or create it with + Month.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "hover:text-white")}>
        Go to your latest month
      </Link>
    </Card>
  );
}
