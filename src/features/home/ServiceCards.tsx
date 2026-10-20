"use client";

import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/ui/Skeleton";
import { seriesListQuery, useTimeseries } from "@/data/useServiceData";
import { formatTimestamp } from "@/lib/format";
import { sparklinePaths } from "./sparkline";
import { SERVICES } from "@/services/registry";
import type { Frequency, SeriesMeta, ServiceMeta } from "@/services/types";
import styles from "./ServiceCards.module.css";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  "5min": "5 min",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = 64;

/** "Sector" → "sectors", "Category" → "categories". */
function plural(label: string, count: number): string {
  const word = label.toLowerCase();
  if (count === 1) return word;
  return word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`;
}

/** How many distinct values each facet has across a catalog, in first-seen order. */
export function facetCounts(series: readonly SeriesMeta[]): { label: string; count: number }[] {
  const values = new Map<string, Set<string>>();
  for (const s of series) {
    for (const facet of s.facets) {
      let set = values.get(facet.label);
      if (!set) values.set(facet.label, (set = new Set()));
      set.add(facet.value);
    }
  }
  return [...values].map(([label, set]) => ({ label: plural(label, set.size), count: set.size }));
}

/**
 * The data services as cards: what each holds, a live preview of its first
 * series, and its size, all from the same catalogs and overview data the
 * service pages use (so opening a card finds them cached).
 */
export function ServiceCards() {
  const catalogs = useQueries({ queries: SERVICES.map((s) => seriesListQuery(s.id)) });
  const loaded = catalogs.every((c) => c.data);
  const total = catalogs.reduce((sum, c) => sum + (c.data?.series.length ?? 0), 0);

  return (
    <section aria-labelledby="services-heading" className={styles.section}>
      <header className={styles.heading}>
        <h2 id="services-heading" className={styles.title}>
          Data services
        </h2>
        <p className={styles.lede}>
          {loaded ? (
            `${total} series across ${SERVICES.length} services. Each opens a page with charts suited to its data.`
          ) : catalogs.some((c) => c.isError) ? (
            `${SERVICES.length} services, each with a page of charts suited to its data.`
          ) : (
            <Skeleton tone="text" width="min(30rem, 80vw)" className={styles.centered} />
          )}
        </p>
      </header>
      <ul role="list" className={styles.cards}>
        {SERVICES.map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            catalog={catalogs[i]?.data?.series}
            failed={catalogs[i]?.isError === true}
          />
        ))}
      </ul>
    </section>
  );
}

function ServiceCard({
  service,
  catalog,
  failed,
}: {
  service: ServiceMeta;
  catalog: readonly SeriesMeta[] | undefined;
  failed: boolean;
}) {
  const first = catalog?.[0];
  // The same request the service page makes for its range navigator.
  const preview = useTimeseries(
    service.id,
    first ? { ids: [first.id], frequency: first.frequencies[0] ?? "daily", fields: [service.defaultField] } : null,
  );
  const columns = preview.data?.series[0];
  const paths = columns
    ? sparklinePaths(columns.t, columns.fields[service.defaultField] ?? [], PREVIEW_WIDTH, PREVIEW_HEIGHT)
    : null;
  const start = columns?.t[0];
  const end = columns?.t.at(-1);

  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <h3 className={styles.name}>
          {/* The whole card is the click target; this link is its name. */}
          <Link href={`/${service.id}`} className={styles.link}>
            {service.label}
          </Link>
        </h3>
        <ul role="list" className={styles.chips} aria-label="Frequencies">
          {service.frequencies.map((f) => (
            <li key={f} className={styles.chip}>
              {FREQUENCY_LABEL[f]}
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.description}>{service.description}</p>

      <figure className={styles.preview}>
        <div className={styles.chart} style={{ height: PREVIEW_HEIGHT }}>
          {paths ? (
            <svg
              viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              className={styles.sparkline}
            >
              <path d={paths.area} className={styles.area} />
              <path d={paths.line} className={styles.line} />
            </svg>
          ) : (
            !failed && !preview.isError && <Skeleton tone="area" className={styles.chartPlaceholder} />
          )}
        </div>
        <figcaption className={styles.caption}>
          {first && start !== undefined && end !== undefined ? (
            `${first.name}, ${formatTimestamp(start)} to ${formatTimestamp(end)}`
          ) : failed || preview.isError ? (
            "Preview unavailable right now"
          ) : (
            <Skeleton tone="text" width="70%" />
          )}
        </figcaption>
      </figure>

      {catalog ? (
        // Shown as "40 series": the number first, by CSS; read as "series, 40".
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>series</dt>
            <dd>{catalog.length}</dd>
          </div>
          {facetCounts(catalog).map(({ label, count }) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      ) : (
        !failed && (
          <div className={styles.facts} aria-hidden="true">
            <Skeleton tone="text" width="9rem" />
          </div>
        )
      )}
    </li>
  );
}
