import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Welcome } from "@/components/auth/welcome";
import { FirstRun } from "@/components/shell/first-run";
import { Card } from "@/components/ui/card";
import { LoadingStatus, Skeleton } from "@/components/ui/skeleton";
import { getSignedInUserId } from "@/data/auth";
import { getLatestMonthKey } from "@/data/months";
import { monthHref } from "@/lib/months";

/**
 * "/": signed out → welcome card (PRD A1). Signed in → the latest month's dashboard, or
 * the first-run choice when the user has no months yet (PRD A3).
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeGate />
    </Suspense>
  );
}

async function HomeGate() {
  if (!(await getSignedInUserId())) return <Welcome />;
  const latest = await getLatestMonthKey();
  if (latest) redirect(monthHref(latest));
  return <FirstRun />;
}

function HomeSkeleton() {
  return (
    <AuthFrame>
      <Card className="w-full max-w-[420px] items-center text-center">
        <LoadingStatus />
        <Skeleton className="h-5 w-64 max-w-full rounded-cf-pill" />
        <Skeleton className="h-11 w-full rounded-cf-pill" />
        <Skeleton className="h-11 w-full rounded-cf-pill" />
      </Card>
    </AuthFrame>
  );
}
