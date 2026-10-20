import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ServiceDashboard, ServiceDashboardSkeleton } from "@/components/dashboard/ServiceDashboard";
import { PageTransition } from "@/components/shell/PageTransition";
import { findService, isServiceId, SERVICES } from "@/services/registry";

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
  const id = (await params).service;
  if (!findService(id) || !isServiceId(id)) notFound();

  // The dashboard reads its view from the URL's query string, so on this
  // statically generated page it must render inside a Suspense boundary.
  return (
    <PageTransition id={id}>
      <Suspense fallback={<ServiceDashboardSkeleton serviceId={id} />}>
        <ServiceDashboard serviceId={id} />
      </Suspense>
    </PageTransition>
  );
}
