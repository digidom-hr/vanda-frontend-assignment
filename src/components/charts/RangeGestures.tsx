"use client";

import { createContext, useContext } from "react";
import type { Span } from "@/lib/range-gestures";

/**
 * What a chart needs to turn a zoom or pan gesture into a new range for the
 * whole page (not just itself).
 */
export interface RangeGestures {
  /** The page's range. */
  readonly range: Span;
  /** The whole history: gestures stop at its ends. */
  readonly extent: Span;
  /** The narrowest range a zoom reaches. */
  readonly minWidth: number;
  /** Sets the page's range; returns the range the page shows for it (rounded to whole days). */
  readonly commit: (range: Span) => Span;
}

const Context = createContext<RangeGestures | null>(null);

/** Provided by the service page around its panels. */
export const RangeGesturesProvider = Context.Provider;

export function useRangeGestures(): RangeGestures | null {
  return useContext(Context);
}
