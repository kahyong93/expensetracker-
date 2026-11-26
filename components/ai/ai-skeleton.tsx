import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the AI tab (DESIGN_SYSTEM §9): blocks in the final shapes, i.e. three
 * insight cards, then the "Ask your money" and "Paste to add" cards. Used by loading.tsx
 * while the month streams in. The grids collapse on their own, so no isPhone here.
 */
export function AiSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <LoadingStatus />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-4">
        <Skeleton className="h-[150px] rounded-cf-card" />
        <Skeleton className="h-[150px] rounded-cf-card" />
        <Skeleton className="h-[150px] rounded-cf-card" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
        <Skeleton className="h-[300px] rounded-cf-card" />
        <Skeleton className="h-[300px] rounded-cf-card" />
      </div>
    </div>
  );
}
