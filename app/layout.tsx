import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { CLERK_APPEARANCE } from "@/components/auth/clerk-appearance";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Personal Cashflow Tracker",
  description: "Money in, money out, and next month's plan",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col tabular-nums" suppressHydrationWarning>
        <ClerkProvider
          appearance={CLERK_APPEARANCE}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          afterSignOutUrl="/"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
