import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import HomePage from "./page";

describe("HomePage", () => {
  it("offers search and links to every data service", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("searchbox", { name: "Search series" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Timeseries" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Alpha", "/alpha"],
      ["Bravo", "/bravo"],
      ["Charlie", "/charlie"],
    ]);
  });
});
