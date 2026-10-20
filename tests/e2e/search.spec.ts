import { expect, test } from "@playwright/test";
import { search, waitForCharts } from "./helpers";

test.describe("global search", () => {
  test("finds a series from the home page and lands on it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search series" }).fill("north eq");
    const results = page.getByRole("listbox", { name: "Search results" });
    await expect(results.getByRole("option")).toHaveCount(1);
    await expect(results.getByRole("option")).toContainText("North America Equity Composite");
    await expect(results.getByRole("option")).toContainText("Charlie");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/charlie\?series=C-0001$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("North America Equity Composite");
    await waitForCharts(page);
  });

  test("opens from anywhere with the keyboard and finds by id", async ({ page }) => {
    await page.goto("/alpha");
    await waitForCharts(page);
    await page.keyboard.press("/");
    const dialog = page.getByRole("dialog", { name: "Search series" });
    await expect(dialog).toBeVisible();
    await page.keyboard.type("b-0108");
    await expect(dialog.getByRole("option").first()).toContainText("Europe Hedge Funds Activity");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Europe Hedge Funds Activity");
    expect(search(page)).toBe("?series=B-0108");
    await expect(dialog).toBeHidden();
  });

  test("orders one entity's series from different services together", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search series" }).fill("acme");
    const names = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
    await expect(names).toHaveCount(4);
    await expect(names.nth(0)).toContainText("Acme Corp (ACMC)");
    await expect(names.nth(1)).toContainText("Acme Corp Composite");
  });
});
