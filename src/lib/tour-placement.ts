export interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface CardPlacement {
  readonly top: number;
  readonly left: number;
  /** Where the card ended up relative to the highlighted element. */
  readonly side: "below" | "above" | "right" | "left" | "overlap";
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where a tour's step card goes, in viewport pixels. It tries, in order:
 * below the highlighted element, above it, to its right, to its left (tall
 * elements such as a sidebar leave no room above or below), and finally
 * along the bottom of the screen. The card always stays `margin` away from
 * the screen edges.
 */
export function placeCard(
  target: Box,
  card: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
  gap = 12,
  margin = 16,
): CardPlacement {
  const left = clamp(target.left, margin, viewport.width - margin - card.width);
  const below = target.top + target.height + gap;
  if (below + card.height <= viewport.height - margin) return { top: below, left, side: "below" };
  const above = target.top - gap - card.height;
  if (above >= margin) return { top: above, left, side: "above" };

  // Beside it, top-aligned with the element where possible.
  const top = clamp(target.top, margin, viewport.height - margin - card.height);
  const right = target.left + target.width + gap;
  if (right + card.width <= viewport.width - margin) return { top, left: right, side: "right" };
  const leftSide = target.left - gap - card.width;
  if (leftSide >= margin) return { top, left: leftSide, side: "left" };

  return { top: Math.max(margin, viewport.height - margin - card.height), left, side: "overlap" };
}
