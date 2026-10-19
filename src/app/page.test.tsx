import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("links to every data service", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Timeseries" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Alpha", "/alpha"],
      ["Bravo", "/bravo"],
      ["Charlie", "/charlie"],
    ]);
  });
});
