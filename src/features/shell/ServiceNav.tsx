"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { preloadTimeChart } from "@/features/charts/TimeChart";
import { SERVICES } from "@/services/registry";
import styles from "./ServiceNav.module.css";

/** True when `pathname` is the service's page or one of its sub-pages. */
export function isServicePath(pathname: string, serviceId: string): boolean {
  return pathname === `/${serviceId}` || pathname.startsWith(`/${serviceId}/`);
}

export function ServiceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Data services" className={styles.nav}>
      <ul role="list" className={styles.list}>
        {SERVICES.map((service) => {
          const current = isServicePath(pathname, service.id);
          return (
            <li key={service.id}>
              <Link
                href={`/${service.id}`}
                aria-current={current ? "page" : undefined}
                className={styles.link}
                // Every service page draws charts: start loading that code on intent.
                onMouseEnter={preloadTimeChart}
                onFocus={preloadTimeChart}
              >
                {service.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
