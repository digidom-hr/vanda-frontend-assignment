import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForCharts } from "./helpers";

const PAGES = [
  { path: "/", charts: false },
  { path: "/alpha?series=A-0001", charts: true },
  { path: "/bravo?series=B-0108", charts: true },
  { path: "/charlie?series=C-0001", charts: true },
  { path: "/not-a-page", charts: false },
];

for (const scheme of ["light", "dark"] as const) {
  for (const { path, charts } of PAGES) {
    test(`@a11y ${path} has no serious accessibility violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      if (charts) await waitForCharts(page);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      // On failure, list each rule with the elements it hit.
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.help} (${v.nodes
              .map((n) => n.target.join(" "))
              .slice(0, 3)
              .join(" | ")})`,
        ),
      ).toEqual([]);
    });
  }
}
