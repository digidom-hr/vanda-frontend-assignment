"use client";

import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, type Key } from "react-aria-components";
import styles from "./SegmentedControl.module.css";

export interface SegmentOption<T extends string> {
  readonly id: T;
  /** Visible content: text, or an icon when `ariaLabel` is given. */
  readonly label: ReactNode;
  /** Accessible name when the label is an icon. */
  readonly ariaLabel?: string;
  readonly isDisabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers, e.g. "Frequency". */
  readonly label: string;
  readonly options: readonly SegmentOption<T>[];
  /** The selected option, or null when none applies (e.g. a custom range is active). */
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly size?: "small" | "medium";
  /**
   * accent: the selected option is filled with the brand colour, for the
   * page's main choices (frequency, range). neutral: a quiet raised segment,
   * for secondary choices that repeat (chart/table in every panel, theme), so
   * purple keeps marking what matters most.
   */
  readonly tone?: "accent" | "neutral";
  readonly className?: string;
}

/**
 * One-of-many choice rendered as a row of buttons (a radio group for
 * assistive tech: arrow keys move, Enter/Space select). Used for theme,
 * chart/table view, frequency and range presets.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "medium",
  tone = "accent",
  className,
}: SegmentedControlProps<T>) {
  const onSelectionChange = (keys: Set<Key>) => {
    const [next] = keys;
    const option = options.find((o) => o.id === next);
    // Only real changes: re-selecting the current option must not, e.g., push URL history.
    if (option && option.id !== value) onChange(option.id);
  };

  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value === null ? [] : [value]}
      onSelectionChange={onSelectionChange}
      className={[styles.group, className].filter(Boolean).join(" ")}
      data-size={size}
      data-tone={tone}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          aria-label={option.ariaLabel}
          isDisabled={option.isDisabled}
          className={styles.option}
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
