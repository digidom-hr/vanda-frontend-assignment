"use client";

import { Switch } from "react-aria-components";
import { SegmentedControl } from "@/components/controls/SegmentedControl";
import { useLinkHover } from "@/hooks/useLinkHover";
import { formatTimestamp } from "@/lib/format";
import { parseTimestamp } from "@/lib/time";
import { RANGE_PRESETS, type RangePreset } from "@/lib/url-state";
import type { Frequency } from "@/services/types";
import styles from "./ViewControls.module.css";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  "5min": "5 min",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function FrequencyControl({
  frequencies,
  value,
  onChange,
}: {
  frequencies: readonly Frequency[];
  value: Frequency;
  onChange: (frequency: Frequency) => void;
}) {
  // A single frequency (all of charlie) shows as the same control with its one
  // option selected: it reads like the other pages, and pressing it changes nothing.
  return (
    <SegmentedControl
      label="Frequency"
      value={value}
      onChange={onChange}
      options={frequencies.map((f) => ({ id: f, label: FREQUENCY_LABELS[f] }))}
    />
  );
}

const PRESET_NAMES: Record<RangePreset, string> = {
  "1M": "Last month",
  "3M": "Last 3 months",
  "6M": "Last 6 months",
  "1Y": "Last year",
  "3Y": "Last 3 years",
  All: "All data",
};

export function RangeControl({
  preset,
  from,
  to,
  onPreset,
}: {
  preset: RangePreset;
  /** A custom range (from the range navigator) replaces the preset while set. */
  from: string | null;
  to: string | null;
  onPreset: (preset: RangePreset) => void;
}) {
  const custom = from !== null || to !== null;
  const describe = (iso: string | null, fallback: string) => {
    const ms = iso ? parseTimestamp(iso) : null;
    return ms === null ? fallback : formatTimestamp(ms);
  };

  return (
    <div className={styles.range}>
      <SegmentedControl
        label="Range"
        value={custom ? null : preset}
        onChange={onPreset}
        options={RANGE_PRESETS.map((p) => ({ id: p, label: p, ariaLabel: PRESET_NAMES[p] }))}
      />
      {custom && (
        <span className={styles.custom}>
          {describe(from, "Start")} to {describe(to, "latest")}
        </span>
      )}
    </div>
  );
}

/**
 * "Link hover": hovering a date in one chart marks it in every chart on the
 * page. Off by default (each chart keeps to itself) and remembered in this
 * browser. Only offered where there is a hover (a mouse or trackpad).
 */
export function LinkHoverSwitch() {
  const [on, setOn] = useLinkHover();
  return (
    <Switch className={styles.switch} isSelected={on} onChange={setOn}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      Link hover
    </Switch>
  );
}
