"use client";

import { Brand } from "@/components/header/brand";
import { HeaderControls } from "@/components/header/header-controls";
import { MainNav } from "@/components/header/main-nav";

/** Sticky glass header: brand, main nav, controls (DESIGN_SYSTEM §7.11). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-cf-line bg-cf-header-glass backdrop-blur-[8px]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3.5 px-6 py-3.5">
        <Brand />
        <MainNav />
        <HeaderControls />
      </div>
    </header>
  );
}
