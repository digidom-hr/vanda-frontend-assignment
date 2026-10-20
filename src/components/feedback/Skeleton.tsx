import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** CSS length; omit to size the shape with `className` instead. */
  readonly width?: CSSProperties["width"];
  readonly height?: CSSProperties["height"];
  /** Corner radius when the real element's differs from a control's, e.g. a checkbox or a pill. */
  readonly radius?: CSSProperties["borderRadius"];
  /**
   * shape: a solid placeholder, e.g. for a control.
   * text: one line of the surrounding text (height defaults to the line height).
   * area: no fill, only the sweep; for large regions such as a chart body.
   */
  readonly tone?: "shape" | "text" | "area";
  readonly className?: string;
}

/**
 * A placeholder for content that is still loading. Purely visual: it is
 * hidden from assistive technology, so the surrounding region should say
 * it is busy (`aria-busy`) or announce "Loading…".
 *
 * Every placeholder's sweep is positioned against the viewport, so all of
 * them shimmer as one band crossing the page instead of flickering
 * independently. Static when the user prefers reduced motion.
 */
export function Skeleton({ width, height, radius, tone = "shape", className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.skeleton, className].filter(Boolean).join(" ")}
      data-tone={tone}
      style={{ width, height, borderRadius: radius }}
    >
      {/* A zero-width character gives a text placeholder a real line, so it sits on the text baseline. */}
      {tone === "text" ? "\u200b" : null}
    </span>
  );
}
