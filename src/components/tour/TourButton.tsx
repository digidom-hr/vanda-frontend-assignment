"use client";

import { usePathname } from "next/navigation";
import { Button } from "react-aria-components";
import { Icon } from "@/components/icons/Icon";
import { isServiceId } from "@/services/registry";
import { TOUR_START_EVENT } from "./tour";
import styles from "./TourButton.module.css";

/** Replays the onboarding tour. Only on service pages, where the tour's controls are. */
export function TourButton() {
  const pathname = usePathname();
  if (!isServiceId(pathname.slice(1))) return null;
  return (
    <Button
      className={styles.button}
      aria-label="Take the tour"
      onPress={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
    >
      <Icon name="circle-help" size={18} />
    </Button>
  );
}
