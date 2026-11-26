"use client";

import { MonthMissing } from "@/components/shell/month-missing";
import { useMonthKey } from "@/lib/use-month-key";

/** not-found.tsx body for the AI tab: the shared "We couldn't find {month}" card. */
export function AiNotFound() {
  const monthKey = useMonthKey();
  return <MonthMissing monthKey={monthKey} tab="ai" />;
}
