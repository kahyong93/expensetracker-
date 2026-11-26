"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OPEN_SIGN_IN_PARAM, OPEN_SIGN_IN_VALUE } from "@/components/auth/auth-params";
import { Button } from "@/components/ui/button";
import { Skeleton, LoadingStatus } from "@/components/ui/skeleton";

/** sessionStorage key for the retry state (survives the remount a refresh causes). */
const RETRY_KEY = "cf-home-redirect";
/** Attempts older than this start over (a later, unrelated visit to "/"). */
const RETRY_WINDOW_MS = 15_000;

type Retry = { step: number; at: number };

function readRetry(): Retry {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RETRY_KEY) ?? "null") as Retry | null;
    if (saved && Date.now() - saved.at < RETRY_WINDOW_MS) return saved;
  } catch {
    // Unreadable: start over.
  }
  return { step: 0, at: Date.now() };
}

/**
 * Shown on "/" when the browser is signed in but the page was rendered signed out (right
 * after signing in from the welcome card). Re-rendering on the server forwards to the
 * latest month or the first-run choice.
 *
 * If the server still sees no session (its session cookie is stale), refreshing again
 * would loop forever, so the retries are bounded: one refresh, then one full page load
 * (Clerk's middleware resyncs the cookie on a document request), then stop and offer to
 * sign in again.
 */
export function HomeRedirect() {
  const router = useRouter();
  const clerk = useClerk();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const retry = readRetry();
    const next = (step: number) => sessionStorage.setItem(RETRY_KEY, JSON.stringify({ step, at: retry.at }));
    if (retry.step === 0) {
      next(1);
      router.refresh();
    } else if (retry.step === 1) {
      next(2);
      // A real document request on purpose: only that lets Clerk's middleware resync the cookie.
      window.location.assign("/"); // eslint-disable-line @next/next/no-location-assign-relative-destination
    } else {
      sessionStorage.removeItem(RETRY_KEY);
      setStuck(true); // eslint-disable-line react-hooks/set-state-in-effect -- one-off fallback after bounded retries
    }
  }, [router]);

  if (stuck) {
    return (
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 p-6 text-center">
        <p role="alert" className="m-0 text-sm text-cf-ink-soft">
          We couldn&apos;t confirm your sign-in. Please sign in again.
        </p>
        <Button
          variant="primary"
          size="touch"
          block
          onClick={() => void clerk.signOut({ redirectUrl: `/?${OPEN_SIGN_IN_PARAM}=${OPEN_SIGN_IN_VALUE}` })}
        >
          Sign in again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 p-6">
      <LoadingStatus />
      <Skeleton className="h-16 rounded-cf-card" />
      <Skeleton className="h-40 rounded-cf-card" />
    </div>
  );
}
