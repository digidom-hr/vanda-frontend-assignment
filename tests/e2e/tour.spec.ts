import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForCharts } from "./helpers";

// A first-time visitor: nothing remembered yet.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("onboarding tour @a11y", () => {
  test("starts on the first service page visit, walks every step, and isn't shown again", async ({ page }) => {
    await page.goto("/alpha");
    await waitForCharts(page);
    const tour = page.getByRole("dialog", { name: "Search every series" });
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("Step 1 of 6");
    await expect(page.getByRole("button", { name: "Next" })).toBeFocused();

    const titles = [
      "Pick and compare series",
      "Frequency and period",
      "Transform the data",
      "Fine-tune the period",
      "Chart or table",
    ];
    for (const title of titles) {
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    }
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await waitForCharts(page);
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("skips with Escape, replays from the header, and passes an accessibility audit", async ({ page }) => {
    await page.goto("/charlie");
    await waitForCharts(page);
    await expect(page.getByRole("dialog", { name: "Search every series" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
    ).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Take the tour" }).click();
    await expect(page.getByRole("dialog", { name: "Search every series" })).toBeVisible();
  });
});
