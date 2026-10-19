/**
 * Panels are declared as data: each service lists what it wants on its page,
 * and the generic ServiceDashboard renders them. Adding a panel or a service
 * means adding a definition, not a page.
 */
import type { ChartSpec } from "@/components/charts/chart-options";
import { levelChart } from "@/components/charts/presets";
import { rebaseTo100 } from "@/lib/compare";
import { applyTransforms, transformLabel, transformedUnit, type TransformSpec } from "@/lib/transforms/pipeline";
import { getField } from "@/services/registry";
import type { Frequency, SeriesColumns, SeriesMeta, ServiceMeta } from "@/services/types";

export interface PanelContext {
  readonly service: ServiceMeta;
  /** Shown series in order; the first is primary. */
  readonly series: readonly SeriesMeta[];
  readonly columns: ReadonlyMap<string, SeriesColumns>;
  readonly frequency: Frequency;
  readonly range: { readonly min: number; readonly max: number };
  readonly transforms: readonly TransformSpec[];
}

export interface PanelDefinition {
  readonly id: string;
  readonly title: string;
  /** Fields this panel needs; the page requests the union for all panels. */
  readonly fields: readonly string[];
  /** primary: the large chart that receives transforms and comparisons. */
  readonly layout: "primary" | "secondary" | "wide";
  readonly bodyHeight: number;
  readonly subtitle?: (ctx: PanelContext) => string;
  /** The chart for the current context, or null when this panel has nothing to show. */
  readonly build: (ctx: PanelContext) => ChartSpec | null;
}

export interface DashboardConfig {
  /** Facet the series picker groups by. */
  readonly groupBy: string;
  /** Field drawn in the overview (time rail); it also gives the data's time extent. */
  readonly overviewField: string;
  readonly panels: readonly PanelDefinition[];
}

const FREQUENCY_TEXT: Record<Frequency, string> = {
  "5min": "5-minute",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** The unit a field is measured in for a series (fixed per field, or the series' own). */
export function fieldUnit(service: ServiceMeta, series: SeriesMeta, field: string): string {
  return getField(service, field)?.unit ?? series.unit;
}

/**
 * The primary panel for one field: transforms apply here, and several shown
 * series are compared. With `rebase`, compared levels are indexed to 100 at
 * the start of the visible range (instruments of different size on one axis).
 */
export function primaryPanel(options: {
  readonly field: string;
  readonly title: string;
  readonly rebase: boolean;
  /** Draw a single series as an area: for levels (price), not for values that cross zero. */
  readonly fill?: boolean;
  readonly bodyHeight?: number;
}): PanelDefinition {
  const willRebase = (ctx: PanelContext) =>
    options.rebase && ctx.series.length > 1 && transformedUnit("level", ctx.transforms) === "level"; // % and σ are already comparable

  return {
    id: `primary-${options.field}`,
    title: options.title,
    fields: [options.field],
    layout: "primary",
    bodyHeight: options.bodyHeight ?? 340,
    subtitle: (ctx) => {
      const parts = [FREQUENCY_TEXT[ctx.frequency]];
      if (ctx.transforms.length) parts.push(ctx.transforms.map(transformLabel).join(" then "));
      if (willRebase(ctx)) parts.push("indexed to 100 at the start of the range");
      return parts.join(", ");
    },
    build: (ctx) => {
      const primary = ctx.series[0];
      if (!primary) return null;
      const rebase = willRebase(ctx);
      const baseUnit = fieldUnit(ctx.service, primary, options.field);
      const unit = rebase ? "index" : transformedUnit(baseUnit, ctx.transforms);
      const series = ctx.series.map((s) => {
        const columns = ctx.columns.get(s.id);
        const t = columns?.t ?? [];
        const transformed = applyTransforms(columns?.fields[options.field] ?? [], ctx.transforms);
        return { id: s.id, name: s.name, t, values: rebase ? rebaseTo100(t, transformed, ctx.range.min) : transformed };
      });
      if (series.every((s) => s.t.length === 0)) return null;
      return levelChart({
        title: options.title,
        description: `${options.title} of ${ctx.series.map((s) => s.name).join(", ")}.`,
        unit,
        height: options.bodyHeight ?? 340,
        intraday: ctx.frequency === "5min",
        range: ctx.range,
        fill: options.fill && ctx.transforms.length === 0,
        series,
      });
    },
  };
}
