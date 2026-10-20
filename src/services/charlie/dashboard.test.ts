import { describe, expect, it } from "vitest";
import type { PanelContext } from "@/features/dashboard/panels";
import { getService } from "@/services/registry";
import { charlieDashboard } from "./dashboard";

describe("charlie dashboard", () => {
  it("draws the score around zero with labelled signal thresholds", () => {
    const score = charlieDashboard.panels[0];
    if (!score || score.kind === "custom") throw new Error("expected the score chart first");
    const ctx: PanelContext = {
      service: getService("charlie"),
      series: [
        {
          service: "charlie",
          id: "C-1",
          name: "C-1",
          facets: [],
          frequencies: ["daily"],
          unit: "score",
          fields: ["value"],
        },
      ],
      columns: new Map([["C-1", { seriesId: "C-1", t: [1, 2], fields: { value: [0.5, 1.2] } }]]),
      frequency: "daily",
      range: { min: 1, max: 2 },
      transforms: [],
    };
    const spec = score.build(ctx);
    expect(spec?.zeroLine).toBe(true);
    expect(spec?.thresholds).toEqual([
      { value: 1, label: "High (≥ 1)" },
      { value: -1, label: "Low (≤ −1)" },
    ]);
    expect(spec?.series[0]?.kind).toBe("line");
  });

  it("puts the signal board beside the score", () => {
    expect(charlieDashboard.panels.map((p) => [p.title, p.layout])).toEqual([
      ["Score", "primary"],
      ["Signal board", "sidebar"],
    ]);
  });
});
