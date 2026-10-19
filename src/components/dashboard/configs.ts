import { alphaDashboard } from "@/services/alpha/dashboard";
import { bravoDashboard } from "@/services/bravo/dashboard";
import { charlieDashboard } from "@/services/charlie/dashboard";
import type { ServiceId } from "@/services/registry";
import type { DashboardConfig } from "./panels";

/**
 * What each service's page shows. Keyed by every registered service, so a
 * new service without a dashboard config is a compile error.
 */
export const DASHBOARDS: Readonly<Record<ServiceId, DashboardConfig>> = {
  alpha: alphaDashboard,
  bravo: bravoDashboard,
  charlie: charlieDashboard,
};
