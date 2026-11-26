import { redirect } from "next/navigation";
import { OPEN_SIGN_IN_PARAM, OPEN_SIGN_IN_VALUE } from "@/components/auth/auth-params";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { AppProviders } from "@/components/providers/app-providers";
import { CashflowDataProvider } from "@/components/providers/cashflow-data-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getSignedInUserId } from "@/data/auth";
import { getMonthBundle } from "@/data/months";
import { getAppData } from "@/data/settings";
import { decodeMonthParam } from "@/lib/months";

/**
 * This layout reads the Clerk session and the user's data at request time, so navigating
 * into a month waits on the server (the (app) layout's skeleton shows meanwhile). Opt it
 * out of instant-navigation validation, as the Next.js "Authentication with Cache
 * Components" guide recommends for session-reading layouts. Tab-to-tab navigation inside
 * the month is still validated.
 */
export const instant = false;

/**
 * Month segment layout: the one place the app's data is fetched (docs/data-fetching.md).
 * It loads the signed-in user's settings, month list and the URL's month on the server,
 * then passes them as props to the client tree. Server Actions revalidate this layout, so
 * every tab sees fresh data after a change. The KPI row (PRD D1–D3) sits above every tab.
 */
export default async function MonthLayout({ children, params }: LayoutProps<"/m/[month]">) {
  const { month } = await params;
  if (!(await getSignedInUserId())) redirect(`/?${OPEN_SIGN_IN_PARAM}=${OPEN_SIGN_IN_VALUE}`);

  const monthKey = decodeMonthParam(month);
  const [app, bundle] = await Promise.all([getAppData(), getMonthBundle(monthKey)]);

  return (
    <CashflowDataProvider data={{ app, monthKey, bundle }}>
      <AppProviders>
        <AppShell>
          <KpiRow />
          {children}
        </AppShell>
      </AppProviders>
    </CashflowDataProvider>
  );
}
