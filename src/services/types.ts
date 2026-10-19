/**
 * Service-agnostic shapes shared by the server (BFF) and the browser. Each
 * data service maps its own upstream payloads onto these, so routes, search
 * and UI never deal with service-specific row formats.
 */

export type Frequency = "5min" | "daily" | "weekly" | "monthly";

/** A numeric column a service can chart. */
export interface FieldMeta {
  readonly key: string;
  readonly label: string;
  /** Fixed unit for this field; omitted when the field takes the series' unit. */
  readonly unit?: string;
  /** Lower values are better (e.g. rank 1), so charts should invert the axis. */
  readonly inverted?: boolean;
  readonly description?: string;
}

/** Client-safe description of a data service. */
export interface ServiceMeta<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly description: string;
  /** Every frequency the service can serve; each series lists its own subset. */
  readonly frequencies: readonly Frequency[];
  readonly fields: readonly FieldMeta[];
  /** Field shown first when a series is opened. */
  readonly defaultField: string;
}

/** A facet of a series, e.g. `{ key: "region", label: "Region", value: "Europe" }`. */
export interface Facet {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/** A series as listed in a service catalog, normalised across services. */
export interface SeriesMeta {
  readonly service: string;
  readonly id: string;
  readonly name: string;
  readonly facets: readonly Facet[];
  /** Frequencies this series has data for, in the service's preferred order. */
  readonly frequencies: readonly Frequency[];
  readonly unit: string;
  /** Keys of the service's fields that this series has. */
  readonly fields: readonly string[];
}

/**
 * Columnar timeseries for one series: `t` holds epoch milliseconds (UTC),
 * ascending, and every field array is aligned with it. `null` marks a
 * timestamp at which that field has no value.
 */
export interface SeriesColumns {
  readonly seriesId: string;
  readonly t: number[];
  readonly fields: Record<string, (number | null)[]>;
}
