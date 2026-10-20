import { flowChart, rankChart, signedLineChart } from "@/features/charts/presets";
import { fieldPanel, primaryPanel, type DashboardConfig } from "@/features/dashboard/panels";
import { movingAverage } from "@/lib/transforms/transforms";

/** Rank is out of the number of companies in the service. */
const COMPANIES = 40;
const RANK_TREND_WINDOW = 20;

/** Alpha's page: price first, then the flow and strength measures for the company in focus. */
export const alphaDashboard: DashboardConfig = {
  groupBy: "group",
  overviewField: "price",
  panels: [
    primaryPanel({ field: "price", title: "Price", rebase: true, fill: true }),
    fieldPanel({
      field: "net_value",
      title: "Net order flow",
      subtitle: "Buy minus sell value",
      chart: (base, series) => flowChart({ ...base, series }),
    }),
    fieldPanel({
      field: "score",
      title: "Score",
      chart: (base, series) => signedLineChart({ ...base, series }),
    }),
    fieldPanel({
      field: "momentum",
      title: "Momentum",
      layout: "half",
      chart: (base, series) => signedLineChart({ ...base, series }),
    }),
    fieldPanel({
      field: "rank",
      title: `Rank among ${COMPANIES}`,
      subtitle: `1 is strongest; line shows the ${RANK_TREND_WINDOW}-point average`,
      layout: "half",
      chart: (base, series) =>
        rankChart({
          ...base,
          of: COMPANIES,
          series: { ...series, name: "Rank" },
          trend: {
            ...series,
            id: `${series.id}:trend`,
            name: `${RANK_TREND_WINDOW}-point average`,
            values: movingAverage(series.values, RANK_TREND_WINDOW),
          },
        }),
    }),
  ],
};
