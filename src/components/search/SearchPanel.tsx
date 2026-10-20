"use client";

import { useState } from "react";
import { Autocomplete, Button, Input, ListBox, ListBoxItem, SearchField } from "react-aria-components";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useSearch } from "@/hooks/useSearch";
import { ApiError } from "@/lib/api-client";
import { formatFacetValue } from "@/lib/format";
import { highlightPrefixes } from "@/lib/highlight";
import type { SearchResult } from "@/services/api-types";
import { findService } from "@/services/registry";
import styles from "./SearchPanel.module.css";

const EXAMPLES = ["Acme", "ACMC", "B-0101", "Europe hedge", "Japan equity"];

/** Where a search result leads: its service page with the series in view. */
export function seriesHref(result: Pick<SearchResult, "service" | "id">): string {
  return `/${result.service}?series=${encodeURIComponent(result.id)}`;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightPrefixes(text, query).map((segment, i) =>
        segment.match ? (
          <mark key={i} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

const serviceLabel = (id: string) => findService(id)?.label ?? id;

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface SearchPanelProps {
  /** `dialog`: inside the ⌘K dialog (focused, scrolling list). `inline`: embedded in a page. */
  variant: "dialog" | "inline";
  /** Called when a result is chosen, e.g. to close the dialog. */
  onNavigate?: () => void;
}

export function SearchPanel({ variant, onNavigate }: SearchPanelProps) {
  const [input, setInput] = useState("");
  const query = useDebouncedValue(input, 120);
  const { data, error, isFetching, refetch } = useSearch(query);

  const active = input.trim().length > 0;
  const slow = useDelayedFlag(active && !data && !error, 5000);
  const results = active && data ? data.results : [];
  const unavailable = data?.services.filter((s) => s.status !== "ok").map((s) => serviceLabel(s.service)) ?? [];
  const settled = active && data !== undefined && !isFetching && data.query === input.trim();

  let announcement = "";
  if (settled) {
    announcement =
      data.total === 0
        ? `No series match ${data.query}.`
        : `${data.total} ${data.total === 1 ? "series matches" : "series match"}.`;
  }

  return (
    <div className={styles.panel} data-variant={variant}>
      <Autocomplete inputValue={input} onInputChange={setInput}>
        <SearchField aria-label="Search series" className={styles.field} autoFocus={variant === "dialog"}>
          <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <Input className={styles.input} placeholder="Company, ticker, id, sector or region" />
          <Button className={styles.clear} aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Button>
        </SearchField>

        {!active && (
          <div className={styles.idle}>
            <p>Search every series in Alpha, Bravo and Charlie by name, ticker, id, sector or region.</p>
            <div className={styles.examples}>
              <span className={styles.examplesLabel}>Try</span>
              {EXAMPLES.map((example) => (
                <button key={example} type="button" className={styles.example} onClick={() => setInput(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {active && error && !data && (
          <div className={styles.notice} role="alert">
            <p>{error instanceof ApiError ? error.message : "Search failed."}</p>
            <button type="button" className={styles.retry} onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        )}

        {active && unavailable.length > 0 && (
          <p className={styles.partial}>
            {listNames(unavailable)} {unavailable.length === 1 ? "is" : "are"} unavailable, so{" "}
            {unavailable.length === 1 ? "its" : "their"} series are missing from these results.
          </p>
        )}

        {active && !data && !error && (
          <p className={styles.status} role="status">
            {slow
              ? "Still searching. If the data services have been idle, they can take up to a minute to start."
              : "Searching"}
          </p>
        )}

        {active && data && (
          <ListBox
            items={results}
            aria-label="Search results"
            aria-busy={isFetching}
            className={styles.results}
            onAction={() => onNavigate?.()}
            renderEmptyState={() =>
              settled ? (
                <p className={styles.empty}>
                  No series match &ldquo;{data.query}&rdquo;. Check the spelling, or search by ticker (ACMC) or id
                  (B-0101).
                </p>
              ) : null
            }
          >
            {(result) => (
              <ListBoxItem
                id={`${result.service}:${result.id}`}
                textValue={`${result.name} ${result.id}`}
                href={seriesHref(result)}
                className={styles.result}
              >
                <span className={styles.name}>
                  <Highlighted text={result.name} query={input} />
                </span>
                <span className={styles.service}>{serviceLabel(result.service)}</span>
                <span className={styles.meta}>
                  <span>
                    <Highlighted text={result.id} query={input} />
                  </span>
                  {result.facets.map((facet) => (
                    <span key={facet.key}>
                      <span className="visually-hidden">{facet.label}: </span>
                      <Highlighted text={formatFacetValue(facet.value)} query={input} />
                    </span>
                  ))}
                  <span>{result.unit}</span>
                </span>
              </ListBoxItem>
            )}
          </ListBox>
        )}

        {settled && data.total > data.results.length && (
          <p className={styles.status}>
            Showing {data.results.length} of {data.total} matches. Add words to narrow the list.
          </p>
        )}
      </Autocomplete>

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
