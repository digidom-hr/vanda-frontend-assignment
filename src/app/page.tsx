import Link from "next/link";
import { SearchPanel } from "@/components/search/SearchPanel";
import { SERVICES } from "@/services/registry";
import type { Frequency } from "@/services/types";
import styles from "./page.module.css";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  "5min": "5 min",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function HomePage() {
  return (
    <div className={styles.home}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Timeseries</h1>
        <p className={styles.lede}>Find a series in any data service, then chart and transform it.</p>
      </header>

      <section aria-label="Search series">
        <SearchPanel variant="inline" />
      </section>

      <section aria-labelledby="services-heading">
        <h2 id="services-heading" className={styles.sectionTitle}>
          Data services
        </h2>
        <ul role="list" className={styles.services}>
          {SERVICES.map((service) => (
            <li key={service.id} className={styles.service}>
              <Link href={`/${service.id}`} className={styles.serviceLink}>
                {service.label}
              </Link>
              <p className={styles.description}>{service.description}</p>
              <p className={styles.frequencies}>
                <span className="visually-hidden">Frequencies: </span>
                {service.frequencies.map((f) => FREQUENCY_LABEL[f]).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
