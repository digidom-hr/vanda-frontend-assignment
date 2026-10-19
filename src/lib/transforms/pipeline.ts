import { cumulative, movingAverage, pctChange, rollingSum, zScore } from "./transforms";
import type { Output, Values } from "./transforms";

/** One step of a transform pipeline. Parameters are counted in data points. */
export type TransformSpec =
  | { kind: "rollingSum"; window: number }
  | { kind: "movingAverage"; window: number }
  | { kind: "pctChange"; periods: number }
  | { kind: "cumulative" }
  | { kind: "zScore"; window?: number };

export type TransformKind = TransformSpec["kind"];

function applyOne(values: Values, spec: TransformSpec): Output {
  switch (spec.kind) {
    case "rollingSum":
      return rollingSum(values, spec.window);
    case "movingAverage":
      return movingAverage(values, spec.window);
    case "pctChange":
      return pctChange(values, spec.periods);
    case "cumulative":
      return cumulative(values);
    case "zScore":
      return zScore(values, spec.window);
  }
}

/** Applies the steps left to right; an empty pipeline returns a copy of the input. */
export function applyTransforms(values: Values, specs: readonly TransformSpec[]): Output {
  let current: Output = [...values];
  for (const spec of specs) current = applyOne(current, spec);
  return current;
}

/** Short label for legends and chips, e.g. "MA(20)". */
export function transformLabel(spec: TransformSpec): string {
  switch (spec.kind) {
    case "rollingSum":
      return `Σ(${spec.window})`;
    case "movingAverage":
      return `MA(${spec.window})`;
    case "pctChange":
      return spec.periods === 1 ? "%Δ" : `%Δ(${spec.periods})`;
    case "cumulative":
      return "Cumulative";
    case "zScore":
      return spec.window === undefined ? "Z-score" : `Z(${spec.window})`;
  }
}

/**
 * The unit of the pipeline's output. Percent change and z-score replace the
 * unit; the others keep whatever unit their input had.
 */
export function transformedUnit(unit: string, specs: readonly TransformSpec[]): string {
  let current = unit;
  for (const spec of specs) {
    if (spec.kind === "pctChange") current = "%";
    else if (spec.kind === "zScore") current = "σ";
  }
  return current;
}
