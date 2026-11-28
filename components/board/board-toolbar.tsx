"use client";

import { useId } from "react";
import { BOARD_COPY } from "@/components/board/board-copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { EntryType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Board title pill (B1), search (B2) and "+ Category" (B9). */
export function BoardToolbar({
  type,
  search,
  onSearchChange,
  onNewCategory,
}: {
  type: EntryType;
  search: string;
  onSearchChange: (value: string) => void;
  onNewCategory: () => void;
}) {
  const searchId = useId();
  return (
    <section className="flex flex-wrap items-center justify-between gap-2.5">
      <h1
        className={cn(
          "m-0 rounded-cf-pill px-3.5 py-1.5 text-[13px] font-extrabold",
          type === "Out" ? "bg-cf-out-tint text-cf-out-tag" : "bg-cf-in-tint text-cf-in-tag",
        )}
      >
        {BOARD_COPY.title(type)}
      </h1>
      <div className="flex flex-[1_1_280px] flex-wrap items-center justify-end gap-2">
        <label htmlFor={searchId} className="sr-only">
          {BOARD_COPY.searchLabel}
        </label>
        <Input
          id={searchId}
          type="search"
          surface="white"
          className="max-w-[260px] flex-[1_1_180px]"
          placeholder={BOARD_COPY.searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        {type === "In" ? (
          <Button variant="outline" size="md" onClick={onNewCategory}>
            {BOARD_COPY.newCategoryButton}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
