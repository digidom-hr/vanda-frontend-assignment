/**
 * Panels are declared as data: each service lists what it wants on its page,
 * and the generic ServiceDashboard renders them. Adding a panel or a service
 * means adding a definition, not a page.
 */
import type { ComponentType } from "react";
import type { ChartSpec } from "@/components/charts/chart-options";
import { flowChart, levelChart, type PresetSeries } from "@/components/charts/presets";
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

interface PanelBase {
  readonly id: string;
  readonly title: string;
  /** Fields this panel needs; the page requests the union for all shown panels. */
  readonly fields: readonly string[];
  /**
   * primary: the large chart that receives transforms and comparisons;
   * sidebar: beside the primary panel, two rows tall; half: half a row; wide: a full row.
   */
  readonly layout: "primary" | "secondary" | "sidebar" | "half" | "wide";
  /**
   * Whether the panel applies to the shown series at all (e.g. gross flow for
   * a net-only series). Unavailable panels are not rendered. Defaults to:
   * the primary series has every field the panel needs.
   */
  readonly isAvailable?: (ctx: Pick<PanelContext, "series">) => boolean;
}

/** A chart panel: the page fetches its fields and renders the spec in a Panel. */
export interface ChartPanelDefinition extends PanelBase {
  readonly kind?: "chart";
  readonly bodyHeight: number;
  readonly subtitle?: (ctx: PanelContext) => string;
  /** The subtitle when it doesn't depend on the context: shown while the data loads, instead of a placeholder. */
  readonly staticSubtitle?: string;
  /** The chart for the current context, or null when this panel has nothing to show. */
  readonly build: (ctx: PanelContext) => ChartSpec | null;
}

export interface CustomPanelProps {
  readonly ctx: PanelContext | null;
  /** Show only this series (e.g. a row pressed in a list). */
  readonly onShowSeries: (id: string) => void;
  readonly className?: string;
}

/** Any other panel (e.g. a list): a component that renders its own Panel and loads its own data. */
export interface CustomPanelDefinition extends PanelBase {
  readonly kind: "custom";
  readonly Component: ComponentType<CustomPanelProps>;
}

export type PanelDefinition = ChartPanelDefinition | CustomPanelDefinition;

/** True when the primary series has every field the panel needs. */
export function panelAvailable(panel: PanelDefinition, ctx: Pick<PanelContext, "series">): boolean {
  if (panel.isAvailable) return panel.isAvailable(ctx);
  const primary = ctx.series[0];
  return primary !== undefined && panel.fields.every((f) => primary.fields.includes(f));
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
  /**
   * level: lines/area (price, scores). flow: per-period signed amounts drawn as
   * columns; comparisons and transforms switch to lines, since several column
   * series on one chart become unreadable.
   */
  readonly style?: "level" | "flow";
  readonly bodyHeight?: number;
  /** Signed values: draw a zero baseline. */
  readonly zeroLine?: boolean;
  readonly thresholds?: ChartSpec["thresholds"];
}): ChartPanelDefinition {
  const willRebase = (ctx: PanelContext) =>
    options.rebase && ctx.series.length > 1 && transformedUnit("level", ctx.transforms) === "level"; // % and σ are already comparable

  return {
    id: `primary-${options.field}`,
    title: options.title,
    fields: [options.field],
    layout: "primary",
    bodyHeight: options.bodyHeight ?? 440,
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
      const base = {
        title: options.title,
        description: `${options.title} of ${ctx.series.map((s) => s.name).join(", ")}.`,
        unit,
        height: options.bodyHeight ?? 440,
        intraday: ctx.frequency === "5min",
        range: ctx.range,
        zeroLine: options.zeroLine,
        thresholds: options.thresholds,
      };
      const [only] = series;
      if (options.style === "flow" && only && series.length === 1 && ctx.transforms.length === 0) {
        return flowChart({ ...base, series: only });
      }
      return levelChart({ ...base, fill: options.fill && ctx.transforms.length === 0, series });
    },
  };
}

/** Settings every chart in a panel shares, derived from the page context. */
export interface ChartBase {
  readonly title: string;
  readonly description: string;
  readonly unit: string;
  readonly height: number;
  readonly intraday: boolean;
  readonly range: { readonly min: number; readonly max: number };
}

/**
 * A panel showing one field of the primary series, drawn with a chart preset.
 * Comparisons and transforms belong to the primary panel; these panels add
 * context about the series in focus.
 */
export function fieldPanel(options: {
  readonly field: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly layout?: PanelDefinition["layout"];
  readonly bodyHeight?: number;
  /** Fields needed besides `field` (for computed values). */
  readonly extraFields?: readonly string[];
  /** Derive the plotted values from the series' columns (default: the field itself). */
  readonly compute?: (fields: SeriesColumns["fields"], t: readonly number[], ctx: PanelContext) => (number | null)[];
  /** Unit of computed values, when it differs from the field's. */
  readonly unit?: string;
  readonly chart: (base: ChartBase, series: PresetSeries) => ChartSpec;
}): ChartPanelDefinition {
  const bodyHeight = options.bodyHeight ?? 180;
  return {
    id: `field-${options.field}-${options.title}`,
    title: options.title,
    fields: [options.field, ...(options.extraFields ?? [])],
    layout: options.layout ?? "secondary",
    bodyHeight,
    subtitle: options.subtitle ? () => options.subtitle as string : undefined,
    staticSubtitle: options.subtitle,
    build: (ctx) => {
      const primary = ctx.series[0];
      const columns = primary ? ctx.columns.get(primary.id) : undefined;
      if (!primary || !columns || columns.t.length === 0) return null;
      const values = options.compute ? options.compute(columns.fields, columns.t, ctx) : columns.fields[options.field];
      if (!values) return null;
      return options.chart(
        {
          title: options.title,
          description: `${options.title} of ${primary.name}.`,
          unit: options.unit ?? fieldUnit(ctx.service, primary, options.field),
          height: bodyHeight,
          intraday: ctx.frequency === "5min",
          range: ctx.range,
        },
        { id: `${primary.id}:${options.field}`, name: primary.name, t: columns.t, values },
      );
    },
  };
}
