import type { ServiceMeta } from "../types";

export const bravoMeta = {
  id: "bravo",
  label: "Bravo",
  description: "Investor flows by region and category, net and gross.",
  frequencies: ["daily", "weekly", "monthly"],
  defaultField: "net",
  // Units vary by series (USD or bps), so fields take the series' unit.
  fields: [
    { key: "net", label: "Net flow" },
    { key: "gross", label: "Gross flow" },
  ],
} as const satisfies ServiceMeta<"bravo">;
