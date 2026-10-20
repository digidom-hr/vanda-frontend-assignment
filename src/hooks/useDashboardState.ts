"use client";

import { createParser, parseAsStringLiteral, throttle, useQueryStates } from "nuqs";
import { useMemo } from "react";
import type { TransformSpec } from "@/lib/transforms/pipeline";
import {
  DEFAULT_RANGE,
  MAX_SELECTED_SERIES,
  parseIsoDateParam,
  parseSeriesIds,
  parseTransforms,
  RANGE_PRESETS,
  serializeSeriesIds,
  serializeTransforms,
  type RangePreset,
} from "@/lib/url-state";
import type { Frequency, ServiceMeta } from "@/services/types";

const sameList = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const seriesParser = createParser<string[]>({ parse: parseSeriesIds, serialize: serializeSeriesIds, eq: sameList });
const transformsParser = createParser<TransformSpec[]>({
  parse: parseTransforms,
  serialize: serializeTransforms,
  eq: (a, b) => serializeTransforms(a) === serializeTransforms(b),
});
const dateParser = createParser<string>({ parse: parseIsoDateParam, serialize: (v) => v });

export interface DashboardState {
  readonly series: string[];
  /** Null means "the series' default frequency". */
  readonly frequency: Frequency | null;
  readonly preset: RangePreset;
  readonly from: string | null;
  readonly to: string | null;
  readonly transforms: TransformSpec[];
}

/**
 * A service page's view state, read from and written to the URL.
 *
 * History: choosing series pushes an entry, so Back returns to the previous
 * selection. Range, frequency and transform tweaks replace the current entry,
 * so using the range navigator doesn't flood the history. URL writes are
 * throttled while dragging.
 */
export function useDashboardState(service: Pick<ServiceMeta, "frequencies">) {
  const keys = useMemo(
    () => ({
      series: seriesParser.withDefault([]).withOptions({ history: "push" }),
      freq: parseAsStringLiteral(service.frequencies),
      range: parseAsStringLiteral(RANGE_PRESETS).withDefault(DEFAULT_RANGE),
      from: dateParser,
      to: dateParser,
      tf: transformsParser.withDefault([]),
    }),
    [service.frequencies],
  );
  const [query, setQuery] = useQueryStates(keys, { history: "replace", clearOnDefault: true });

  const state: DashboardState = {
    series: query.series,
    frequency: query.freq,
    preset: query.range,
    from: query.from,
    to: query.to,
    transforms: query.tf,
  };

  const actions = useMemo(
    () => ({
      /** Show exactly these series (first = primary). */
      selectSeries: (ids: readonly string[]) => setQuery({ series: ids.slice(0, MAX_SELECTED_SERIES) }),
      /** Add a series to the comparison, or remove it if already shown. */
      toggleCompare: (id: string) =>
        setQuery((prev) => ({
          series: prev.series.includes(id)
            ? prev.series.filter((s) => s !== id)
            : [...prev.series, id].slice(0, MAX_SELECTED_SERIES),
        })),
      setFrequency: (frequency: Frequency | null) => setQuery({ freq: frequency }),
      /** A preset replaces any custom range. */
      setPreset: (preset: RangePreset) => setQuery({ range: preset, from: null, to: null }),
      setCustomRange: (from: string, to: string) => setQuery({ from, to }, { limitUrlUpdates: throttle(200) }),
      setTransforms: (transforms: readonly TransformSpec[]) => setQuery({ tf: [...transforms] }),
    }),
    [setQuery],
  );

  return [state, actions] as const;
}
