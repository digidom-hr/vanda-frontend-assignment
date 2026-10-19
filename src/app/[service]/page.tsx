import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findService, SERVICES } from "@/services/registry";
import styles from "./page.module.css";

interface ServicePageProps {
  params: Promise<{ service: string }>;
}

// One page per registered service; any other path segment is a 404.
export const dynamicParams = false;

export function generateStaticParams(): { service: string }[] {
  return SERVICES.map((s) => ({ service: s.id }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const service = findService((await params).service);
  return service ? { title: service.label, description: service.description } : {};
}

export default async function ServicePage({ params }: ServicePageProps) {
  const service = findService((await params).service);
  if (!service) notFound();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{service.label}</h1>
        <p className={styles.description}>{service.description}</p>
      </header>
    </div>
  );
}
