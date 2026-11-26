import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard loading state (DESIGN_SYSTEM §9): skeleton blocks in the final shapes,
 * the Where it went / What came in pair and the Top spending card. Uses only the
 * self-collapsing grids, so it is correct on both layouts and safe to render on the server.
 */
function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-cf-card border-2 border-cf-line bg-cf-surface p-[22px] shadow-cf-card">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-40 rounded-cf-pill" />
        <Skeleton className="h-7 w-32 rounded-cf-pill" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full rounded-cf-pill" />
          <Skeleton className="h-[7px] w-full rounded-cf-pill" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <LoadingStatus label="Loading dashboard…" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-5">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
      <SkeletonCard rows={4} />
    </div>
  );
}
