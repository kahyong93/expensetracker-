"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { OPEN_SIGN_IN_PARAM, OPEN_SIGN_IN_VALUE } from "@/components/auth/auth-params";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";

/**
 * Client-side lock for the app pages: signed-out visitors go to the welcome page, which
 * opens the sign-in modal. Shows the shell skeleton until Clerk knows who is signed in.
 * This is UX only. The real guard is on the server: the month layout redirects signed-out
 * requests, and every /data helper throws without a Clerk session.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace(`/?${OPEN_SIGN_IN_PARAM}=${OPEN_SIGN_IN_VALUE}`);
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) return <ShellSkeleton />;
  return children;
}
