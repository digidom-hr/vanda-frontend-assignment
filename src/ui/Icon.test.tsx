import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("is decorative: the control around it carries the name", () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the same line weight in screen pixels at any size", () => {
    const stroke = (size: number) =>
      Number(
        render(<Icon name="x" size={size} />)
          .container.querySelector("svg")
          ?.getAttribute("stroke-width"),
      );
    // 1.5px on screen: 2.25 units on the 24-unit grid at 16px, 3.6 at 10px.
    expect(stroke(16) * (16 / 24)).toBeCloseTo(1.5);
    expect(stroke(10) * (10 / 24)).toBeCloseTo(1.5);
  });
});
