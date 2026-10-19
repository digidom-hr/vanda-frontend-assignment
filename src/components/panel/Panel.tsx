"use client";

import { useId, useState, type ReactNode } from "react";
import type { TableData } from "@/components/charts/chart-table";
import { SegmentedControl } from "@/components/controls/SegmentedControl";
import { ApiError } from "@/lib/api-client";
import { DataTable } from "./DataTable";
import styles from "./Panel.module.css";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

export interface PanelProps {
  readonly title: string;
  readonly headingLevel?: 2 | 3;
  /** Short context under the title, e.g. "Daily close, USD". */
  readonly subtitle?: string;
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
  /** Height reserved in every state, so the layout never jumps. */
  readonly bodyHeight: number;
  readonly variant?: "primary" | "secondary";
  readonly className?: string;
  readonly children: ReactNode;
}

type View = "chart" | "table";

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
  bodyHeight,
  variant = "secondary",
  className,
  children,
}: PanelProps) {
  const [view, setView] = useState<View>("chart");
  const headingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const showTable = view === "table" && table !== undefined && status === "success" && !isEmpty;

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
      <div className={styles.loading} aria-busy="true">
        <span className="visually-hidden">Loading {title}</span>
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
          {readout && <div className={styles.readout}>{readout}</div>}
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
