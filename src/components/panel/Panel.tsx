"use client";

import { useId, useState, type ReactNode } from "react";
import type { TableData } from "@/components/charts/chart-table";
import { SegmentedControl } from "@/components/controls/SegmentedControl";
import { ApiError } from "@/lib/api-client";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { DataTable } from "./DataTable";
import styles from "./Panel.module.css";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

/** After this long, a loading panel explains itself (e.g. a data service waking up). */
export const SLOW_LOAD_MS = 5000;

export const SLOW_LOAD_MESSAGE =
  "Still loading. If the data service has been idle, it can take up to a minute to start.";

export interface PanelProps {
  readonly title: string;
  readonly headingLevel?: 2 | 3;
  /** Short context under the title, e.g. "Daily close, USD", or its placeholder while loading. */
  readonly subtitle?: ReactNode;
  /** The current value or summary, right-aligned in the header. */
  readonly readout?: ReactNode;
  /** Controls that belong to this panel (e.g. transform chips). */
  readonly toolbar?: ReactNode;
  readonly status: "pending" | "error" | "success";
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly isEmpty?: boolean;
  readonly emptyMessage?: string;
  /** Data is reloading: the content stays visible, dimmed. */
  readonly isRefreshing?: boolean;
  /** Enables the Chart/Table switch. */
  readonly table?: TableData;
  /**
   * Explain a load that takes longer than SLOW_LOAD_MS. Pages that show one
   * page-level message for all their panels turn this off.
   */
  readonly explainSlowLoad?: boolean;
  /** Height reserved in every state, so the layout never jumps. */
  readonly bodyHeight: number;
  /**
   * What the loading placeholder looks like: an empty chart (default) or rows
   * of a list. A chart placeholder also holds the place of the Chart/Table switch.
   */
  readonly placeholder?: "chart" | "list";
  readonly variant?: "primary" | "secondary";
  readonly className?: string;
  readonly children: ReactNode;
}

type View = "chart" | "table";

/** Varied widths so the list placeholder reads as rows of text, not a grid of bars. */
const LIST_PLACEHOLDER_WIDTHS = ["62%", "48%", "70%", "55%", "40%", "66%", "52%", "58%", "44%", "68%", "50%", "60%"];

function errorMessage(error: unknown, title: string): { message: string; retryable: boolean } {
  if (error instanceof ApiError) return { message: error.message, retryable: error.retryable };
  return { message: `${title} couldn't be loaded.`, retryable: true };
}

/**
 * The frame every chart sits in. It owns the panel's states (loading, empty,
 * error with retry, refreshing), the table view, and render-error
 * containment, so individual charts only describe their data.
 */
export function Panel({
  title,
  headingLevel = 2,
  subtitle,
  readout,
  toolbar,
  status,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "No data in this range. Choose a longer range.",
  isRefreshing,
  table,
  explainSlowLoad = true,
  bodyHeight,
  placeholder = "chart",
  variant = "secondary",
  className,
  children,
}: PanelProps) {
  const [view, setView] = useState<View>("chart");
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const showTable = view === "table" && table !== undefined && status === "success" && !isEmpty;
  const slow = useDelayedFlag(explainSlowLoad && status === "pending", SLOW_LOAD_MS);

  const failure = (message: string, retry?: () => void) => (
    <div className={styles.state} role="alert">
      <p>{message}</p>
      {retry && (
        <button type="button" className={styles.retry} onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );

  let body: ReactNode;
  if (status === "pending") {
    body = (
      <div className={styles.loading} data-placeholder={placeholder} aria-busy="true">
        {placeholder === "list" ? (
          <div className={styles.listPlaceholder}>
            {LIST_PLACEHOLDER_WIDTHS.map((width, i) => (
              <div key={i} className={styles.listRow}>
                <Skeleton tone="text" width={width} />
                <Skeleton tone="text" width="2.5rem" />
              </div>
            ))}
          </div>
        ) : (
          <Skeleton tone="area" className={styles.sweep} />
        )}
        {slow ? (
          <p className={styles.slow} role="status">
            {SLOW_LOAD_MESSAGE}
          </p>
        ) : (
          <span className="visually-hidden">Loading {title}</span>
        )}
      </div>
    );
  } else if (status === "error") {
    const { message, retryable } = errorMessage(error, title);
    body = failure(message, retryable ? onRetry : undefined);
  } else if (isEmpty) {
    body = (
      <div className={styles.state}>
        <p>{emptyMessage}</p>
      </div>
    );
  } else if (showTable) {
    body = <DataTable data={table} maxHeight={bodyHeight} />;
  } else {
    body = children;
  }

  return (
    <section
      className={[styles.panel, className].filter(Boolean).join(" ")}
      data-variant={variant}
      aria-labelledby={headingId}
    >
      <header className={styles.header}>
        <div className={styles.titles}>
          <Heading id={headingId} className={styles.title}>
            {title}
          </Heading>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.headerEnd}>
          {readout ? (
            <div className={styles.readout}>{readout}</div>
          ) : (
            status === "pending" && (
              <div className={styles.readout}>
                <Skeleton tone="text" width="8rem" />
              </div>
            )
          )}
          {status === "pending" && placeholder === "chart" && <Skeleton className={styles.viewSwitchPlaceholder} />}
          {table && (
            <SegmentedControl
              label={`${title} view`}
              size="small"
              value={view}
              onChange={setView}
              options={[
                { id: "chart", label: "Chart" },
                { id: "table", label: "Table" },
              ]}
            />
          )}
        </div>
      </header>

      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}

      <div
        className={styles.body}
        style={{ minHeight: bodyHeight }}
        data-refreshing={(isRefreshing && status === "success") || undefined}
        aria-busy={isRefreshing || undefined}
      >
        <PanelErrorBoundary fallback={(reset) => failure(`${title} failed to display.`, reset)}>
          {body}
        </PanelErrorBoundary>
      </div>
    </section>
  );
}
