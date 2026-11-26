import { Suspense, type ReactNode } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";

/**
 * Signed-in app. The month layout below loads the user's data on the server (request
 * time: auth + database), so it streams in behind this prerendered skeleton.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
