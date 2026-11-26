"use client";

import { UserButton } from "@clerk/nextjs";
import { useLayoutMode } from "@/components/providers/layout-mode-provider";

/**
 * Signed-in user's avatar (PRD A1). Opens Clerk's menu with "Manage account" and
 * "Sign out"; sign-out returns to the welcome page (afterSignOutUrl on ClerkProvider).
 * 44px on phone, 36px on laptop to line up with the header pills.
 */
export function AccountButton() {
  const { isPhone } = useLayoutMode();
  return (
    <UserButton
      appearance={{
        elements: {
          userButtonTrigger: "rounded-cf-pill focus-visible:outline-2 focus-visible:outline-cf-primary",
          userButtonAvatarBox: isPhone ? "size-11" : "size-9",
        },
      }}
    />
  );
}
