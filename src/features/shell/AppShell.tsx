import Link from "next/link";
import type { ReactNode } from "react";
import { VandaLogo } from "@/ui/VandaLogo";
import { SearchDialog } from "@/features/search/SearchDialog";
import { TourButton } from "@/features/tour/TourButton";
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
          {/* Named "Vanda Timeseries": the logo's title plus the product name. */}
          <Link href="/" className={styles.wordmark}>
            <VandaLogo height={30} title="Vanda" />
            <span className={styles.product}>Timeseries</span>
          </Link>
          <div className={styles.search}>
            <SearchDialog />
          </div>
          <ServiceNav />
          <div className={styles.tools}>
            <TourButton />
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
