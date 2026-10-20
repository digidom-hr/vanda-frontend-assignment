"use client";

import { useSyncExternalStore } from "react";
import { LINK_HOVER_STORAGE_KEY, readLinkHover, storeLinkHover } from "./link-hover";

const CHANGE_EVENT = "linkhoverchange";

function subscribe(onChange: () => void): () => void {
  // Other tabs report through "storage"; this tab through its own event.
  const onStorage = (event: StorageEvent) => {
    if (event.key === LINK_HOVER_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setLinkHover(on: boolean): void {
  storeLinkHover(on);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The "Link hover" preference and its setter. The server renders it off; the stored value takes over after hydration. */
export function useLinkHover(): readonly [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, readLinkHover, () => false), setLinkHover];
}
