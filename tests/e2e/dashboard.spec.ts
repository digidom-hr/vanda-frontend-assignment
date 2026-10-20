import { expect, test } from "@playwright/test";
import { search, waitForCharts } from "./helpers";

test.describe("service dashboard", () => {
  test("the page ends where its content ends", async ({ page }) => {
    // Charlie has the longest series list: hidden parts of the list must not stretch the page.
    await page.setViewportSize({ width: 1440, height: 1300 });
    await page.goto("/charlie");
    await waitForCharts(page);
    const { pageHeight, contentBottom } = await page.evaluate(() => ({
      pageHeight: document.documentElement.scrollHeight,
      contentBottom: (document.querySelector("main") as HTMLElement).getBoundingClientRect().bottom + window.scrollY,
    }));
    expect(pageHeight).toBeLessThanOrEqual(Math.max(contentBottom, 1300) + 1);
  });

  test("applies a transform, keeps it across a reload, and removes it", async ({ page }) => {
    await page.goto("/alpha?series=A-0004&range=6M");
    await waitForCharts(page);
    const price = page.getByRole("region", { name: "Price" });

    await price.getByRole("button", { name: "Add transform" }).click();
    await page
      .getByRole("dialog", { name: "Add a transform" })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await expect(price.getByText("Daily, MA(20)")).toBeVisible();
    expect(search(page)).toContain("tf=ma:20");

    await page.reload();
    await waitForCharts(page);
    await expect(price.getByText("Daily, MA(20)")).toBeVisible();
    await expect(price.getByRole("list", { name: "Applied transforms, in order" })).toContainText("MA(20)");

    await price.getByRole("button", { name: "Remove MA(20)" }).click();
    await expect(price.getByText("Daily", { exact: true })).toBeVisible();
    expect(search(page)).not.toContain("tf=");
  });

  test("Back and Forward move through series selections", async ({ page }) => {
    await page.goto("/alpha?series=A-0001");
    await waitForCharts(page);
    const picker = page.getByRole("grid", { name: "Alpha series" });

    await picker.getByText("Lumen Technologies (LUMT)").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lumen Technologies (LUMT)");
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acme Corp (ACMC)");
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lumen Technologies (LUMT)");
  });

  test("compares series rebased to 100", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=3M");
    await waitForCharts(page);
    // React Aria visually hides the native input; users click the visible label.
    await page.locator("label", { has: page.getByRole("checkbox", { name: /^Compare Lumen Technologies/ }) }).click();
    await expect(page.getByText("Comparing 2 series")).toBeVisible();
    await expect(page.getByRole("region", { name: "Price" }).getByText(/indexed to 100/)).toBeVisible();
  });

  test("the time rail drives every panel", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=6M");
    await waitForCharts(page);
    const end = page.getByRole("slider", { name: "End of period" });
    await end.focus();
    await page.keyboard.press("Shift+ArrowLeft");
    // Shift moves about a month of data points: 21 trading days back from 31 Dec is 2 Dec.
    await expect(page).toHaveURL(/from=2025-06-30&to=2025-12-02/);
    // Every panel's latest value now comes from inside the new period.
    const readouts = page.locator("main section header").filter({ hasText: /on \d+ \w+ 2025/ });
    await expect(readouts.first()).toContainText("2 Dec 2025");
    await expect(readouts.filter({ hasText: "31 Dec 2025" })).toHaveCount(0);
  });

  test("switches a panel between chart and table", async ({ page }) => {
    await page.goto("/charlie?series=C-0001&range=1M");
    await waitForCharts(page);
    const score = page.getByRole("region", { name: "Score" });
    await score.getByRole("radio", { name: "Table" }).click();
    const table = score.getByRole("table", { name: "Score (score)" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("rowheader").first()).toHaveText("31 Dec 2025");
    await score.getByRole("radio", { name: "Chart" }).click();
    await expect(score.locator(".highcharts-root")).toBeVisible();
  });

  test("loads 5-minute data for the visible window only", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("frequency=5min")) requests.push(decodeURIComponent(r.url()));
    });
    await page.goto("/alpha?series=A-0001&freq=5min&range=1M");
    await waitForCharts(page);
    expect(requests.some((u) => u.includes("from=2025-11-30") && u.includes("to=2025-12-31"))).toBe(true);
  });
});
