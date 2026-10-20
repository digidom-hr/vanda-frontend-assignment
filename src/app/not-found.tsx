import Link from "next/link";
import { SERVICES } from "@/services/registry";

export default function NotFound() {
  return (
    <div className="status-page">
      <h1 className="status-page-title">Page not found</h1>
      <p className="status-page-body">This address doesn&apos;t match a data service. Open one of these instead:</p>
      <ul role="list" className="status-page-links">
        {SERVICES.map((s) => (
          <li key={s.id}>
            <Link href={`/${s.id}`}>{s.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
