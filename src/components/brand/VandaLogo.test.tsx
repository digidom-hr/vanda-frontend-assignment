import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VandaLogo } from "./VandaLogo";

describe("VandaLogo", () => {
  it("is an image named by its title", () => {
    render(<VandaLogo height={30} title="Vanda" />);
    const logo = screen.getByRole("img", { name: "Vanda" });
    expect(logo.querySelectorAll("path")).toHaveLength(2); // mark and wordmark
  });

  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(<VandaLogo height={30} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws the V alone, keeping its proportions", () => {
    const { container } = render(<VandaLogo variant="mark" height={22} />);
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.querySelectorAll("path")).toHaveLength(1);
    expect([svg.getAttribute("height"), svg.getAttribute("width")]).toEqual(["22", "25"]);
  });
});
