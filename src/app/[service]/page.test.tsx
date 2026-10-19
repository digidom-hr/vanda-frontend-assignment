import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ServicePage, { generateMetadata, generateStaticParams } from "./page";

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

  it("renders the service heading and metadata", async () => {
    render(await ServicePage(params("bravo")));
    expect(screen.getByRole("heading", { level: 1, name: "Bravo" })).toBeInTheDocument();
    expect(await generateMetadata(params("bravo"))).toMatchObject({ title: "Bravo" });
  });

  it("is a 404 for an unknown service", async () => {
    await expect(ServicePage(params("delta"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
