import type { ServiceMeta } from "../types";

export const alphaMeta = {
  id: "alpha",
  label: "Alpha",
  description: "Equities: price, order flow and relative strength per company.",
  frequencies: ["daily", "5min"],
  defaultField: "price",
  fields: [
    { key: "price", label: "Price", unit: "USD" },
    { key: "price_change", label: "Price change", unit: "%", description: "Change versus the previous bar." },
    { key: "buy_value", label: "Buy value", unit: "USD" },
    { key: "sell_value", label: "Sell value", unit: "USD" },
    { key: "net_value", label: "Net value", unit: "USD", description: "Buy value minus sell value." },
    { key: "total_value", label: "Total value", unit: "USD", description: "Buy value plus sell value." },
    { key: "group_net_value", label: "Sector net value", unit: "USD", description: "Net value of the whole sector." },
    { key: "score", label: "Score", unit: "score" },
    { key: "momentum", label: "Momentum", unit: "index" },
    { key: "rank", label: "Rank", unit: "rank", inverted: true, description: "1 is strongest." },
  ],
} as const satisfies ServiceMeta<"alpha">;
