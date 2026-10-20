"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { SegmentedControl } from "@/components/controls/SegmentedControl";
import { Icon } from "@/components/icons/Icon";
import {
  applyThemePreference,
  readThemePreference,
  storeThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

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

const OPTIONS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
  { id: "system", label: "Use system theme", icon: <Icon name="monitor" /> },
  { id: "light", label: "Use light theme", icon: <Icon name="sun" /> },
  { id: "dark", label: "Use dark theme", icon: <Icon name="moon" /> },
];

export function ThemeToggle() {
  // The server cannot know the stored preference, so it renders "system";
  // the client value takes over after hydration without a mismatch.
  const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);

  return (
    <SegmentedControl
      label="Theme"
      tone="neutral"
      value={preference}
      onChange={setPreference}
      options={OPTIONS.map((option) => ({ id: option.id, label: option.icon, ariaLabel: option.label }))}
    />
  );
}
