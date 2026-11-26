"use client";

import { MonthMissing } from "@/components/shell/month-missing";
import { useMonthKey } from "@/lib/use-month-key";

/** notFound() under the Income tab: the month doesn't exist, so offer the latest one. */
export default function NotFound() {
  const monthKey = useMonthKey();
  return <MonthMissing monthKey={monthKey} tab="income" />;
}
