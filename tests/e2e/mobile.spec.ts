import { expect, test } from "@playwright/test";
import { waitForCharts } from "./helpers";

test.describe("@mobile phone layout", () => {
  test("searches from the header sheet", async ({ page }) => {
    await page.goto("/alpha");
    await page.getByRole("button", { name: "Search series" }).click();
    const sheet = page.getByRole("dialog", { name: "Search series" });
    await sheet.getByRole("searchbox").fill("japan equity");
    await sheet.getByRole("option").first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Japan Equity Composite");
  });

  test("changes series from the series sheet", async ({ page }) => {
    await page.goto("/bravo");
    await waitForCharts(page);
    await page.getByRole("button", { name: "Change series" }).click();
    const sheet = page.getByRole("dialog", { name: "Bravo series" });
    await sheet.getByText("Europe Retail Activity").click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Europe Retail Activity");
  });

  test("has no horizontal scrolling", async ({ page }) => {
    for (const path of ["/", "/alpha", "/bravo", "/charlie"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
