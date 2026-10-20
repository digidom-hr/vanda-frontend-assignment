"use client";

import { useMemo } from "react";
import { Collection, GridList, GridListHeader, GridListItem, GridListSection, type Key } from "react-aria-components";
import type { CustomPanelProps } from "@/components/dashboard/panels";
import { Panel } from "@/components/panel/Panel";
import { useCharlieLatest } from "@/hooks/useServiceData";
import { formatFacetValue, formatNumber, formatTimestamp } from "@/lib/format";
import type { CharlieLatest, CharlieSignal } from "./meta";
import styles from "./SignalBoard.module.css";

const SIGNAL_TEXT: Record<CharlieSignal, { glyph: string; word: string }> = {
  high: { glyph: "▲", word: "High" },
  mid: { glyph: "●", word: "Mid" },
  low: { glyph: "▼", word: "Low" },
};

interface Group {
  readonly id: string;
  readonly label: string;
  readonly items: CharlieLatest[];
}

/** Latest values grouped by category, strongest first within each. */
export function groupLatest(latest: readonly CharlieLatest[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of latest) {
    const label = formatFacetValue(item.category);
    let group = groups.get(label);
    if (!group) {
      group = { id: label, label, items: [] };
      groups.set(label, group);
    }
    group.items.push(item);
  }
  for (const group of groups.values()) group.items.sort((a, b) => b.value - a.value);
  return [...groups.values()];
}

/**
 * Every charlie series' latest score and signal, so an analyst sees where the
 * extremes are before choosing what to chart. Signals are a glyph plus a word,
 * never colour alone. Pressing a row shows that series.
 */
export function SignalBoard({ ctx, onShowSeries, className }: CustomPanelProps) {
  const latest = useCharlieLatest();
  const items = useMemo(() => latest.data?.latest ?? [], [latest.data]);
  const groups = useMemo(() => groupLatest(items), [items]);
  const shownIds = ctx?.series.map((s) => s.id) ?? [];
  const shown = new Set(shownIds);
  // React Aria re-renders a row only when its item changes, but these rows
  // also depend on which series is shown. Passed as a primitive, so the rows
  // re-render exactly when the shown series change (same fix as SeriesPicker).
  const dependencies = [shownIds.join(",")];

  const counts = { high: 0, mid: 0, low: 0 };
  for (const item of items) counts[item.signal]++;
  const asOf = items[0] ? formatTimestamp(items[0].t) : null;

  return (
    <Panel
      title="Signal board"
      subtitle={asOf ? `Latest score per series on ${asOf}` : "Latest score per series"}
      readout={
        items.length ? (
          <>
            <b>{counts.high}</b> high, <b>{counts.mid}</b> mid, <b>{counts.low}</b> low
          </>
        ) : null
      }
      status={latest.isError && !latest.data ? "error" : latest.data ? "success" : "pending"}
      error={latest.error}
      onRetry={() => void latest.refetch()}
      isEmpty={latest.data !== undefined && items.length === 0}
      bodyHeight={560}
      placeholder="list"
      explainSlowLoad={false}
      className={className}
    >
      <GridList
        aria-label="Latest signals"
        onAction={(key: Key) => onShowSeries(String(key))}
        dependencies={dependencies}
        className={styles.list}
        style={{ maxHeight: 560 }}
      >
        <Collection items={groups} dependencies={dependencies}>
          {(group) => (
            <GridListSection id={group.id}>
              <GridListHeader className={styles.header}>{group.label}</GridListHeader>
              <Collection
                items={group.items.map((item) => ({ ...item, id: item.seriesId }))}
                dependencies={dependencies}
              >
                {(item) => {
                  const signal = SIGNAL_TEXT[item.signal];
                  return (
                    <GridListItem
                      id={item.seriesId}
                      textValue={item.name}
                      className={styles.row}
                      data-shown={shown.has(item.seriesId) || undefined}
                    >
                      <span className={styles.name}>
                        {item.name}
                        {shown.has(item.seriesId) && <span className="visually-hidden"> (shown)</span>}
                      </span>
                      <span className={styles.value}>{formatNumber(item.value, 2)}</span>
                      <span className={styles.signal} data-signal={item.signal}>
                        <span className={styles.glyph} aria-hidden="true">
                          {signal.glyph}
                        </span>
                        {signal.word}
                      </span>
                    </GridListItem>
                  );
                }}
              </Collection>
            </GridListSection>
          )}
        </Collection>
      </GridList>
    </Panel>
  );
}
