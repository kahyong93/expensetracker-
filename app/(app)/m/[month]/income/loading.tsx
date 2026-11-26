"use client";

import { BoardSkeleton } from "@/components/board/board-skeleton";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";

/**
 * Income board loading state (DESIGN_SYSTEM §9 "Loading (data)"). Reuses the board's own
 * skeleton so the route fallback and the store-hydration fallback are the same shape
 * (no jump between two skeletons): title pill row, share bar card, then columns.
 */
export default function Loading() {
  const { isPhone } = useLayoutMode();
  return <BoardSkeleton isPhone={isPhone} />;
}
