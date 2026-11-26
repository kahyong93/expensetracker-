"use client";

import { SignInButton, SignUpButton, useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { OPEN_SIGN_IN_PARAM, OPEN_SIGN_IN_VALUE } from "@/components/auth/auth-params";
import { HomeRedirect } from "@/components/shell/home-redirect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";

/**
 * "/" — signed out: welcome card whose buttons open Clerk's sign-in / sign-up modal.
 * Signed in: forwards to the latest month (HomeRedirect).
 */
export function Welcome() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const opened = useRef(false);

  // Arrived from a protected link (/?auth=sign-in): open the sign-in modal once.
  useEffect(() => {
    if (!isLoaded || isSignedIn || opened.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(OPEN_SIGN_IN_PARAM) !== OPEN_SIGN_IN_VALUE) return;
    opened.current = true;
    window.history.replaceState(null, "", "/");
    clerk.openSignIn();
  }, [isLoaded, isSignedIn, clerk]);

  if (isLoaded && isSignedIn) return <HomeRedirect />;

  return (
    <AuthFrame>
      <Card className="w-full max-w-[420px] items-center text-center">
        {isLoaded ? (
          <>
            <p className="m-0 text-sm text-cf-ink-soft">Sign in to see your months, budgets and AI tips.</p>
            <div className="flex w-full flex-col gap-2.5">
              <SignInButton mode="modal">
                <Button variant="primary" size="touch" block>
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline" size="touch" block>
                  Create account
                </Button>
              </SignUpButton>
            </div>
          </>
        ) : (
          <>
            <LoadingStatus />
            <Skeleton className="h-5 w-64 max-w-full rounded-cf-pill" />
            <Skeleton className="h-11 w-full rounded-cf-pill" />
            <Skeleton className="h-11 w-full rounded-cf-pill" />
          </>
        )}
      </Card>
    </AuthFrame>
  );
}
