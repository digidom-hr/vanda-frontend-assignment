/**
 * Display text for a raw facet value: "single_name" -> "Single name",
 * "equity" -> "Equity". Values that already have capitals ("North America",
 * "Hedge Funds") are left as the service wrote them.
 */
export function formatFacetValue(value: string): string {
  const spaced = value.replace(/_/g, " ").trim();
  if (spaced !== spaced.toLowerCase()) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
