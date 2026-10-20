"use client";

import type { ReactNode } from "react";
import { Switch as AriaSwitch } from "react-aria-components";
import styles from "./Switch.module.css";

export interface SwitchProps {
  readonly isSelected: boolean;
  readonly onChange: (isSelected: boolean) => void;
  /** The visible label; it is also the switch's accessible name. */
  readonly children: ReactNode;
}

/** An on/off switch with its label: React Aria's Switch (keyboard, `role="switch"`), drawn with the tokens. */
export function Switch({ isSelected, onChange, children }: SwitchProps) {
  return (
    <AriaSwitch className={styles.switch} isSelected={isSelected} onChange={onChange}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {children}
    </AriaSwitch>
  );
}
