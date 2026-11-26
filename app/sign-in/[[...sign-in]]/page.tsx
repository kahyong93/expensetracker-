import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";

/**
 * Full-page sign-in. The app normally opens this as a modal from the welcome page; this
 * page is kept for direct links, password-reset and social sign-in returns.
 */
export default function SignInPage() {
  return (
    <AuthFrame>
      <Suspense>
        <SignIn />
      </Suspense>
    </AuthFrame>
  );
}
