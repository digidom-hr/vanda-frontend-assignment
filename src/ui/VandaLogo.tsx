import styles from "./VandaLogo.module.css";

// Paths from Vanda's logo (vanda-logo.svg): the V mark, and the VANDA wordmark under it.
const MARK =
  "m33.1 2.2c1.7 0.5 2.9 1.9 2.9 3.5q0 0.4-0.1 0.8c0 0 0.4-0.8 0.7-1.2 0.9-1.5 2.1-2.6 3.5-3.1 0 0-7 0-7 0zm-5.2 21.8c0 0-6.9-15.7-8.7-18.7-1-1.5-2.2-2.6-3.5-3.1h13.8c-1.7 0.6-2.9 1.9-2.9 3.5q0 0.5 0.2 1c0.6 1.6 4.5 10.1 4.5 10.1l-3.4 7.2z";
const WORDMARK =
  "m48.8 36.8v0.4l-1.5 3.4h-2l5.2-11.3 5.2 11.3h-2l-1.5-3.3v-0.4l-1.7-4-1.7 3.9zm-0.8-0.5h5l0.3 1.5h-5.6l0.3-1.5zm-11.4 4.3v-1.7h2.3q0.7 0 1.4-0.3 0.7-0.2 1.2-0.6 0.5-0.5 0.8-1.2 0.2-0.7 0.3-1.6-0.1-0.9-0.3-1.5-0.3-0.7-0.8-1.2-0.5-0.4-1.2-0.7-0.7-0.2-1.4-0.2h-2.3v-1.7h2.3q1.6 0 2.9 0.7 1.2 0.6 1.9 1.8 0.7 1.2 0.7 2.8 0 1.6-0.7 2.8-0.7 1.2-1.9 1.9-1.3 0.7-2.9 0.7h-2.3zm0.7 0h-1.9v-10.7h1.9zm-5.1-10.6v11.1l-7.8-7.6v7.1h-1.8v-11.2l7.8 7.7v-7.1zm-18.5 6.9l-0.1 0.4-1.4 3.3h-2.1l5.2-11.2 5.3 11.2h-2.1l-1.4-3.2-0.1-0.5-1.7-3.9-1.6 3.9zm-0.8-0.5h5l0.3 1.5h-5.6l0.3-1.5zm-4.5-6.4h2.1l-5.2 11.2-5.3-11.2h2.1l3.2 7.5z";

export interface VandaLogoProps {
  /** "full": mark over the wordmark; "mark": the V alone (small sizes, loading). */
  readonly variant?: "full" | "mark";
  /** Rendered height in pixels; the width follows the logo's proportions. */
  readonly height: number;
  /** Accessible name; omit when the logo is decorative next to text that names it. */
  readonly title?: string;
  readonly className?: string;
}

/**
 * Vanda's logo, drawn inline so its colours come from the design tokens:
 * purple mark and grey wordmark in light mode, lilac and white in dark mode
 * (the colours of Vanda's own light and white logo files).
 */
export function VandaLogo({ variant = "full", height, title, className }: VandaLogoProps) {
  // Cropped to the artwork: the full logo, or just the V.
  const viewBox = variant === "full" ? "0 2 56 39.4" : "15.6 2.1 25 22";
  const [, , w, h] = viewBox.split(" ").map(Number) as [number, number, number, number];
  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={Math.round((height * w) / h)}
      className={[styles.logo, className].filter(Boolean).join(" ")}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path className={styles.mark} d={MARK} />
      {variant === "full" && <path className={styles.wordmark} d={WORDMARK} />}
    </svg>
  );
}
