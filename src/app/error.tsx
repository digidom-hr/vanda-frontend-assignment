"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "./status-page.module.css";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.status} role="alert">
      <h1 className={styles.title}>This page didn&apos;t load</h1>
      <p className={styles.body}>Something failed while rendering it. Try again, or go back to the start page.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>
          Try again
        </button>
        <Link href="/">Go to start page</Link>
      </div>
    </div>
  );
}
