import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AppShell.module.css";
import { ServiceNav } from "./ServiceNav";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link href="/" className={styles.wordmark}>
            Timeseries
          </Link>
          <ServiceNav />
          <div className={styles.tools}>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
