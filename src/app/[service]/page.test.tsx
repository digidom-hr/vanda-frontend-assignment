import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicePage, { generateMetadata, generateStaticParams } from "./page";

// The dashboard has its own tests; here we only check the page wires it up.
vi.mock("@/features/dashboard/ServiceDashboard", () => ({
  ServiceDashboard: ({ serviceId }: { serviceId: string }) => <p>Dashboard for {serviceId}</p>,
  ServiceDashboardSkeleton: ({ serviceId }: { serviceId: string }) => <p>Loading {serviceId}</p>,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const params = (service: string) => ({ params: Promise.resolve({ service }) });

describe("service page", () => {
  it("pre-renders one page per registered service", () => {
    expect(generateStaticParams()).toEqual([{ service: "alpha" }, { service: "bravo" }, { service: "charlie" }]);
  });

  it("renders the service's dashboard and metadata", async () => {
    render(await ServicePage(params("bravo")));
    expect(screen.getByText("Dashboard for bravo")).toBeInTheDocument();
    expect(await generateMetadata(params("bravo"))).toMatchObject({ title: "Bravo" });
  });

  it("is a 404 for an unknown service", async () => {
    await expect(ServicePage(params("delta"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
