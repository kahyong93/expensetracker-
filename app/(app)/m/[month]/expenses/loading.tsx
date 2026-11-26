"use client";

import { BoardSkeleton } from "@/components/board/board-skeleton";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";

/** Expenses board skeleton while the route segment loads (DESIGN_SYSTEM §9). */
export default function Loading() {
  const { isPhone } = useLayoutMode();
  return <BoardSkeleton isPhone={isPhone} label="Loading expenses board…" />;
}
