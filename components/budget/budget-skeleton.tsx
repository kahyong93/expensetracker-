import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";

const ROWS = [0, 1, 2, 3];

/** Loading state for the Budget tab (DESIGN_SYSTEM §9): the summary card and planner rows. */
export function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <LoadingStatus />
      <Skeleton className="h-[180px] rounded-cf-card" />
      <div
        aria-hidden="true"
        className="flex flex-col gap-4 rounded-cf-card border-2 border-cf-line bg-cf-surface px-[22px] py-5"
      >
        {ROWS.map((row) => (
          <div key={row} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/3 rounded-cf-pill" />
            <Skeleton className="h-1.5 rounded-cf-pill" />
            <Skeleton className="h-1.5 w-2/3 rounded-cf-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
