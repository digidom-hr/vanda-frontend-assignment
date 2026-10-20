import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isServicePath, ServiceNav } from "./ServiceNav";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("isServicePath", () => {
  it.each([
    ["/alpha", true],
    ["/alpha/A-0001", true],
    ["/alphabet", false],
    ["/", false],
  ])("%s -> %s", (path, expected) => {
    expect(isServicePath(path, "alpha")).toBe(expected);
  });
});

describe("ServiceNav", () => {
  it("is a labelled navigation landmark with a link per service", () => {
    render(<ServiceNav />);
    const nav = screen.getByRole("navigation", { name: "Data services" });
    expect(nav).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/alpha", "/bravo", "/charlie"]);
  });

  it("marks only the current service", () => {
    pathname.value = "/bravo";
    render(<ServiceNav />);
    expect(screen.getByRole("link", { name: "Bravo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Alpha" })).not.toHaveAttribute("aria-current");
  });
});
