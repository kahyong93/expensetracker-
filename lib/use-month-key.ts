"use client";

import { useParams } from "next/navigation";
import { decodeMonthParam } from "@/lib/months";

/** The month key from the URL (`/m/[month]/…`), decoded. */
export function useMonthKey(): string {
  const params = useParams<{ month?: string }>();
  return decodeMonthParam(params.month ?? "");
}
