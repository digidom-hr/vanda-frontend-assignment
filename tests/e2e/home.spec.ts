import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("a service card opens its page from anywhere on it, its mini chart included", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: "Bravo" }).locator("xpath=ancestor::li[1]");
    const chart = card.locator("svg").first();
    await expect(chart).toBeVisible();
    // Click where the chart is drawn, as a person would (the card's link layer sits on top of it).
    const box = (await chart.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/bravo$/);
  });
});
