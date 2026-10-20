import type { ServiceMeta } from "@/services/types";

export const charlieMeta = {
  id: "charlie",
  label: "Charlie",
  description: "Composite scores by market and asset class, with high/mid/low signals.",
  frequencies: ["daily"],
  defaultField: "value",
  fields: [{ key: "value", label: "Score", unit: "score" }],
} as const satisfies ServiceMeta<"charlie">;

/** Thresholds the service uses to derive `signal` from the latest value. */
export const CHARLIE_SIGNAL_THRESHOLD = 1;

export type CharlieSignal = "high" | "mid" | "low";

/** Latest value of a charlie series, with the service's signal classification. */
export interface CharlieLatest {
  readonly seriesId: string;
  readonly name: string;
  readonly category: string;
  readonly t: number;
  readonly value: number;
  readonly unit: string;
  readonly signal: CharlieSignal;
}
