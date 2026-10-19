"use client";

import { useMemo, useState } from "react";
import {
  Checkbox,
  Collection,
  GridList,
  GridListHeader,
  GridListItem,
  GridListSection,
  Input,
  SearchField,
  type Key,
} from "react-aria-components";
import { formatFacetValue } from "@/lib/format";
import { matchesQuery } from "@/lib/search";
import type { SeriesMeta } from "@/services/types";
import styles from "./SeriesPicker.module.css";

export interface SeriesPickerProps {
  /** Names the list, e.g. "Alpha series". */
  readonly label: string;
  readonly series: readonly SeriesMeta[];
  /** Facet key to group by, e.g. "group" (sector) or "region". */
  readonly groupBy: string;
  /** Selected series ids; the first is the one shown as primary. */
  readonly selected: readonly string[];
  readonly maxSelected: number;
  /** Show only this series (row press / Enter). */
  readonly onShow: (id: string) => void;
  /** Add to or remove from the comparison (checkbox / Space). */
  readonly onToggleCompare: (id: string) => void;
  /** Why a series can't join the current comparison (e.g. a different unit), or null. */
  readonly compareBlockedReason?: (series: SeriesMeta) => string | null;
}

interface Group {
  readonly id: string;
  readonly label: string;
  readonly series: SeriesMeta[];
}

function groupSeries(series: readonly SeriesMeta[], groupBy: string): Group[] {
  const groups = new Map<string, Group>();
  for (const s of series) {
    const facet = s.facets.find((f) => f.key === groupBy);
    const label = facet ? formatFacetValue(facet.value) : "Other";
    let group = groups.get(label);
    if (!group) {
      group = { id: label, label, series: [] };
      groups.set(label, group);
    }
    group.series.push(s);
  }
  return [...groups.values()];
}

/**
 * The series list of one service: grouped, filterable, keyboard-navigable
 * (one Tab stop; arrow keys move between rows, ArrowRight reaches a row's
 * checkbox). Pressing a row shows that series; the checkbox adds it to a
 * comparison.
 */
export function SeriesPicker({
  label,
  series,
  groupBy,
  selected,
  maxSelected,
  onShow,
  onToggleCompare,
  compareBlockedReason,
}: SeriesPickerProps) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => series.filter((s) => matchesQuery(s, filter)), [series, filter]);
  const groups = useMemo(() => groupSeries(visible, groupBy), [visible, groupBy]);
  const primary = selected[0];
  const full = selected.length >= maxSelected;

  const blocked = new Map<string, string>();
  for (const s of series) {
    if (selected.includes(s.id)) continue;
    const reason = full ? `Compare up to ${maxSelected} series` : (compareBlockedReason?.(s) ?? null);
    if (reason) blocked.set(s.id, reason);
  }

  return (
    <div className={styles.picker}>
      <SearchField aria-label={`Filter ${label}`} value={filter} onChange={setFilter} className={styles.filter}>
        <Input className={styles.filterInput} placeholder={`Filter ${series.length} series`} />
      </SearchField>

      <GridList
        aria-label={label}
        // No list selection: a row press shows the series. Comparison is a
        // separate checkbox in each row (React Aria's toggle selection would
        // turn every row press into a toggle once anything is selected).
        onAction={(key: Key) => onShow(String(key))}
        className={styles.list}
        renderEmptyState={() => <p className={styles.empty}>No series match &ldquo;{filter}&rdquo;.</p>}
      >
        <Collection items={groups}>
          {(group) => (
            <GridListSection id={group.id} className={styles.section}>
              <GridListHeader className={styles.header}>{group.label}</GridListHeader>
              <Collection items={group.series}>
                {(s) => {
                  const reason = blocked.get(s.id);
                  const isPrimary = s.id === primary;
                  const isCompared = selected.includes(s.id);
                  const isLast = isCompared && selected.length === 1;
                  return (
                    <GridListItem
                      id={s.id}
                      textValue={s.name}
                      className={styles.item}
                      data-primary={isPrimary || undefined}
                    >
                      <Checkbox
                        className={styles.checkbox}
                        aria-label={`Compare ${s.name}`}
                        isSelected={isCompared}
                        // The last series on screen can't be removed; there must always be one.
                        isDisabled={reason !== undefined || isLast}
                        onChange={() => onToggleCompare(s.id)}
                      >
                        <span className={styles.box} aria-hidden="true">
                          <svg viewBox="0 0 12 12" width="10" height="10">
                            <path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </span>
                      </Checkbox>
                      <span className={styles.name}>
                        {s.name}
                        {isPrimary && <span className="visually-hidden"> (shown)</span>}
                      </span>
                      <span className={styles.meta}>{reason ?? s.id}</span>
                    </GridListItem>
                  );
                }}
              </Collection>
            </GridListSection>
          )}
        </Collection>
      </GridList>
    </div>
  );
}
