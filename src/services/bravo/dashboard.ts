import { flowChart, signedLineChart } from "@/features/charts/presets";
import { fieldPanel, primaryPanel, type DashboardConfig } from "@/features/dashboard/panels";
import { cumulative } from "@/lib/transforms/transforms";

/**
 * Bravo's page: investor flows. Net flow per period first, then the context an
 * analyst checks next: how big the gross activity was, how much has flowed in
 * or out over the visible period, and how one-sided the activity was. Panels
 * that need gross flow only appear for series that have it.
 */
export const bravoDashboard: DashboardConfig = {
  groupBy: "region",
  overviewField: "net",
  panels: [
    primaryPanel({ field: "net", title: "Net flow", rebase: false, style: "flow" }),
    fieldPanel({
      field: "gross",
      title: "Gross flow",
      subtitle: "Total activity per period",
      chart: (base, series) => flowChart({ ...base, series }),
    }),
    fieldPanel({
      field: "net",
      title: "Cumulative net flow",
      subtitle: "Since the start of the visible range",
      // Accumulate from the range start, so the line answers "how much over this period".
      compute: (fields, t, ctx) =>
        cumulative((fields.net ?? []).map((v, i) => ((t[i] as number) < ctx.range.min ? null : v))),
      chart: (base, series) => signedLineChart({ ...base, series }),
    }),
    fieldPanel({
      field: "net",
      title: "Net share of gross",
      subtitle: "How one-sided the activity was",
      extraFields: ["gross"],
      unit: "%",
      layout: "wide",
      compute: (fields) => {
        const gross = fields.gross ?? [];
        return (fields.net ?? []).map((v, i) => {
          const g = gross[i];
          return v === null || g === null || g === undefined || g === 0 ? null : (v / g) * 100;
        });
      },
      chart: (base, series) => signedLineChart({ ...base, series }),
    }),
  ],
};
