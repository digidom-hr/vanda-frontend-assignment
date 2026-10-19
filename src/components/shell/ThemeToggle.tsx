"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, type Key } from "react-aria-components";
import {
  applyThemePreference,
  isThemePreference,
  readThemePreference,
  storeThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

const CHANGE_EVENT = "themepreferencechange";

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyThemePreference(readThemePreference());
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setPreference(preference: ThemePreference): void {
  storeThemePreference(preference);
  applyThemePreference(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const icon = (path: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    {path}
  </svg>
);

const OPTIONS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    id: "system",
    label: "Use system theme",
    icon: icon(
      <>
        <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 13.75h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>,
    ),
  },
  {
    id: "light",
    label: "Use light theme",
    icon: icon(
      <>
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>,
    ),
  },
  {
    id: "dark",
    label: "Use dark theme",
    icon: icon(
      <path
        d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />,
    ),
  },
];

export function ThemeToggle() {
  // The server cannot know the stored preference, so it renders "system";
  // the client value takes over after hydration without a mismatch.
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);

  const onSelectionChange = (keys: Set<Key>) => {
    const [next] = keys;
    if (isThemePreference(next)) setPreference(next);
  };

  return (
    <ToggleButtonGroup
      aria-label="Theme"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[preference]}
      onSelectionChange={onSelectionChange}
      className={styles.group}
    >
      {OPTIONS.map((option) => (
        <ToggleButton key={option.id} id={option.id} aria-label={option.label} className={styles.button}>
          {option.icon}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
