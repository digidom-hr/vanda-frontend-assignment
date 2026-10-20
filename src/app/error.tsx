"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/ui/Icon";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="status-page" role="alert">
      <h1 className="status-page-title">This page didn&apos;t load</h1>
      <p className="status-page-body">Something failed while rendering it. Try again, or go back to the start page.</p>
      <div className="status-page-actions">
        <button type="button" className="status-page-primary" onClick={reset}>
          <Icon name="rotate-ccw" size={14} />
          Try again
        </button>
        <Link href="/">Go to start page</Link>
      </div>
    </div>
  );
}
