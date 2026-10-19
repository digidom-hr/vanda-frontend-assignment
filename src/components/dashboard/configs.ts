import { alphaDashboard } from "@/services/alpha/dashboard";
import type { ServiceId } from "@/services/registry";
import { primaryPanel, type DashboardConfig } from "./panels";

/**
 * What each service's page shows. Keyed by every registered service, so a
 * new service without a dashboard config is a compile error.
 */
export const DASHBOARDS: Readonly<Record<ServiceId, DashboardConfig>> = {
  alpha: alphaDashboard,
  bravo: {
    groupBy: "region",
    overviewField: "net",
    panels: [primaryPanel({ field: "net", title: "Net flow", rebase: false })],
  },
  charlie: {
    groupBy: "category",
    overviewField: "value",
    panels: [primaryPanel({ field: "value", title: "Score", rebase: false })],
  },
};
