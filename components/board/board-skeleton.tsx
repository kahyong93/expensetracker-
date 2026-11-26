import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Item-card placeholders per column. */
const COLUMN_ITEMS = [3, 2, 3, 1] as const;

/**
 * Loading state for a category board (DESIGN_SYSTEM §9 "Loading (data)"): the final board
 * shape in track-coloured blocks with a soft pulse. Title pill row, share bar card, then
 * columns; on phone the columns are collapsed (header + toggle only, §8.2).
 * No hooks, so it renders in Server and Client Components alike.
 */
export function BoardSkeleton({ isPhone = false, label = "Loading board…" }: { isPhone?: boolean; label?: string }) {
  const columns = isPhone ? COLUMN_ITEMS.slice(0, 3) : COLUMN_ITEMS;
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <LoadingStatus label={label} />

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Skeleton className="h-[30px] w-[min(100%,320px)] rounded-cf-pill" />
        <div className="flex flex-[1_1_280px] flex-wrap items-center justify-end gap-2">
          <Skeleton className={cn("max-w-[260px] min-w-0 flex-[1_1_180px] rounded-cf-input", isPhone ? "h-11" : "h-9")} />
          <Skeleton className={cn("w-[108px] rounded-cf-pill", isPhone ? "h-11" : "h-9")} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-cf-card-sm border-[1.5px] border-cf-line bg-cf-surface px-[18px] py-4">
        <Skeleton className="h-3 rounded-cf-pill" />
        <div className="flex flex-wrap gap-3.5">
          {columns.map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-24 rounded-cf-pill" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-start gap-3.5">
        {columns.map((items, i) => (
          <ColumnSkeleton key={i} items={items} collapsed={isPhone} />
        ))}
      </div>
    </div>
  );
}

function ColumnSkeleton({ items, collapsed }: { items: number; collapsed: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-cf-column border-2 border-cf-line bg-cf-surface shadow-cf-column">
      <div className="flex flex-col gap-2 p-3.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28 rounded-cf-pill" />
          <Skeleton className="h-4 w-7 rounded-cf-pill" />
        </div>
        <div className="flex items-baseline justify-between gap-1.5">
          <Skeleton className="h-[26px] w-32 rounded-cf-pill" />
          <Skeleton className="h-5 w-16 rounded-cf-pill" />
        </div>
      </div>
      {collapsed ? null : (
        <div className="flex min-h-[110px] flex-col gap-2 p-2.5">
          {Array.from({ length: items }, (_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-cf-item" />
          ))}
        </div>
      )}
      <div className="grid place-items-center border-t-[1.5px] border-cf-track py-2.5">
        <Skeleton className="h-4 w-28 rounded-cf-pill" />
      </div>
    </div>
  );
}
