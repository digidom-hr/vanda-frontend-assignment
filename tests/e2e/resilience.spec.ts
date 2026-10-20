import { expect, test } from "@playwright/test";
import { waitForCharts } from "./helpers";

// The mock API never fails on its own, so outages are simulated at the
// network layer: the browser's requests to our API answer the way our API
// does when a data service is down. The mock API itself is untouched.
const unavailable = {
  status: 503,
  contentType: "application/json",
  body: JSON.stringify({
    error: { code: "unavailable", message: "The data service is unavailable.", retryable: true },
  }),
};

test.describe("resilience", () => {
  // The client retries transient failures with backoff before giving up.
  test.slow();

  test("a service whose catalog is down shows a clear error and recovers on retry", async ({ page }) => {
    await page.route("**/api/bravo/series", (route) => route.fulfill(unavailable));
    await page.goto("/bravo");
    // Scoped to main: Next.js's route announcer also has role="alert".
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("Bravo is unavailable", { timeout: 30_000 });
    await expect(alert).toContainText("The data service is unavailable.");

    await page.unroute("**/api/bravo/series");
    await alert.getByRole("button", { name: "Try again" }).click();
    await waitForCharts(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("North America Retail Activity");
  });

  test("a failing data request errors in the panels, not the whole page", async ({ page }) => {
    await page.route("**/api/charlie/timeseries**", (route) => route.fulfill(unavailable));
    await page.goto("/charlie");
    const score = page.getByRole("region", { name: "Score" });
    await expect(score.getByRole("alert")).toContainText("The data service is unavailable.", { timeout: 30_000 });
    // The rest of the page still works: picker and signal board render.
    await expect(page.getByRole("grid", { name: "Charlie series" })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Latest signals" })).toBeVisible();
  });

  test("search says which services are missing when results are partial", async ({ page }) => {
    await page.route("**/api/search**", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.services = body.services.map((s: { service: string }) =>
        s.service === "bravo" ? { ...s, status: "unavailable" } : s,
      );
      body.results = body.results.filter((r: { service: string }) => r.service !== "bravo");
      await route.fulfill({ response, json: body });
    });
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search series" }).fill("europe");
    await expect(page.getByText("Bravo is unavailable, so its series are missing from these results.")).toBeVisible();
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option").first()).toBeVisible();
  });
});

test.describe("loading", () => {
  test("placeholders hold the layout: panels don't move when the data arrives", async ({ page }) => {
    // A slow service: every request answers after a delay.
    await page.route("**/api/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    const panelTops = () =>
      page.locator("main section").evaluateAll((sections) => sections.map((s) => s.getBoundingClientRect().top));

    await page.goto("/alpha");
    await expect(page.getByText("Loading Alpha series")).toBeAttached();
    const loading = await panelTops();
    await waitForCharts(page);
    expect(await panelTops()).toEqual(loading);
  });
});
