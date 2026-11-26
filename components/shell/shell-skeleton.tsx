import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";

/**
 * Prerendered fallback for the app shell while URL data (month, tab) streams in.
 * Laptop shape, matching the server-rendered layout (DESIGN_SYSTEM §8.3 hydration rule).
 */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-cf-paper">
      <LoadingStatus />
      <div className="sticky top-0 z-30 border-b-2 border-cf-line bg-cf-header-glass backdrop-blur-[8px]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3.5 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 -rotate-6 rounded-cf-tile" />
            <Skeleton className="h-6 w-56 rounded-cf-pill" />
          </div>
          <Skeleton className="h-10 w-[480px] max-w-full rounded-cf-pill" />
          <Skeleton className="h-9 w-[360px] max-w-full rounded-cf-pill" />
        </div>
      </div>
      <div className="mx-auto box-border flex w-full max-w-[1240px] flex-1 flex-col gap-5 p-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <Skeleton className="h-[150px] rounded-cf-card" />
          <Skeleton className="h-[150px] rounded-cf-card" />
          <Skeleton className="h-[150px] rounded-cf-card" />
        </div>
        <Skeleton className="h-[320px] rounded-cf-card" />
      </div>
    </div>
  );
}
