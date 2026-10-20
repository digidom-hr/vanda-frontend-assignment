import { primaryPanel, type DashboardConfig } from "@/features/dashboard/panels";
import { formatNumber } from "@/lib/format";
import { CHARLIE_SIGNAL_THRESHOLD } from "./meta";
import { SignalBoard } from "./SignalBoard";

const threshold = formatNumber(CHARLIE_SIGNAL_THRESHOLD, 0);

/**
 * Charlie's page: composite scores. The chosen score with its signal
 * thresholds, beside a board of every series' latest signal.
 */
export const charlieDashboard: DashboardConfig = {
  groupBy: "category",
  overviewField: "value",
  panels: [
    primaryPanel({
      field: "value",
      title: "Score",
      rebase: false,
      zeroLine: true,
      bodyHeight: 520,
      thresholds: [
        { value: CHARLIE_SIGNAL_THRESHOLD, label: `High (≥ ${threshold})` },
        { value: -CHARLIE_SIGNAL_THRESHOLD, label: `Low (≤ −${threshold})` },
      ],
    }),
    {
      kind: "custom",
      id: "signal-board",
      title: "Signal board",
      fields: [],
      layout: "sidebar",
      Component: SignalBoard,
    },
  ],
};
