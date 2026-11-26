import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Dashboard tab (PRD §7.4). The month layout loads the user's data on the server and
 * provides it to the client view, so this page has nothing extra to fetch.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
