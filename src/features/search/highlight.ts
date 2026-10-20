import { words } from "@/lib/search";

export interface TextSegment {
  readonly text: string;
  readonly match: boolean;
}

/**
 * Splits `text` into segments, marking the start of each word that a query
 * word is a prefix of, which is the same rule the search uses to match.
 */
export function highlightPrefixes(text: string, query: string): TextSegment[] {
  const tokens = words(query);
  if (tokens.length === 0) return [{ text, match: false }];

  const segments: TextSegment[] = [];
  const push = (part: string, match: boolean) => {
    if (!part) return;
    const last = segments[segments.length - 1];
    if (last && last.match === match) segments[segments.length - 1] = { text: last.text + part, match };
    else segments.push({ text: part, match });
  };

  for (const part of text.split(/([\p{L}\p{N}]+)/u)) {
    const normalized = words(part)[0];
    const token = normalized
      ? tokens.filter((t) => normalized.startsWith(t)).sort((a, b) => b.length - a.length)[0]
      : undefined;
    // Only split when normalising kept the length (true for unaccented text); otherwise mark the whole word.
    if (token && normalized) {
      const cut = normalized.length === part.length ? token.length : part.length;
      push(part.slice(0, cut), true);
      push(part.slice(cut), false);
    } else {
      push(part, false);
    }
  }
  return segments;
}
