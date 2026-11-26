import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";

/**
 * Full-page sign-up. The app normally opens this as a modal from the welcome page; this
 * page is kept for direct links, password-reset and social sign-in returns.
 */
export default function SignUpPage() {
  return (
    <AuthFrame>
      <Suspense>
        <SignUp />
      </Suspense>
    </AuthFrame>
  );
}
