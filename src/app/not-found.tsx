import Link from "next/link";
import { SERVICES } from "@/services/registry";
import styles from "./status-page.module.css";

export default function NotFound() {
  return (
    <div className={styles.status}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.body}>This address doesn&apos;t match a data service. Open one of these instead:</p>
      <ul role="list" className={styles.links}>
        {SERVICES.map((s) => (
          <li key={s.id}>
            <Link href={`/${s.id}`}>{s.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
