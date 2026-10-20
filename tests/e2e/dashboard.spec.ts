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

  test("crossfades between services and between series", async ({ page }) => {
    // Record which parts each view transition animates, and with which
    // animation: ours (vt-rise-in), not the browser's default fade.
    await page.addInitScript(() => {
      const log: string[] = [];
      Object.assign(window, { __viewTransitions: log });
      const start = document.startViewTransition?.bind(document);
      if (!start) return;
      document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
        const transition = start(update);
        void transition.ready.then(() => {
          const parts = document
            .getAnimations()
            .map(
              (a) => `${(a.effect as KeyframeEffect | null)?.pseudoElement ?? ""}=${(a as CSSAnimation).animationName}`,
            );
          log.push(parts.join(" "));
        });
        return transition;
      }) as typeof document.startViewTransition;
    });
    const last = () =>
      page.evaluate(() => (window as unknown as { __viewTransitions: string[] }).__viewTransitions.at(-1));

    await page.goto("/alpha");
    await waitForCharts(page);
    await page.getByRole("navigation").getByRole("link", { name: "Bravo" }).click();
    await expect(page).toHaveURL(/\/bravo/);
    await expect.poll(last).toContain("::view-transition-new(page)=vt-rise-in");
    // While a view transition runs, the browser doesn't deliver clicks to the
    // animating content; wait for it to finish, as a person reading the page would.
    await expect
      .poll(() =>
        page.evaluate(() =>
          document
            .getAnimations()
            .some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition")),
        ),
      )
      .toBe(false);

    await page
      .getByRole("row", { name: /Europe Retail Activity/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Europe Retail Activity");
    await expect.poll(last).toContain("::view-transition-new(series-heading)=vt-rise-in");
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

  test("ticks a series into the comparison from anywhere left of its name", async ({ page }) => {
    await page.goto("/alpha?series=A-0001");
    await waitForCharts(page);
    // Near the row's left edge, beside the small square: this used to replace the selection.
    const row = (await page.getByRole("row", { name: /Lumen Technologies/ }).boundingBox())!;
    await page.mouse.click(row.x + 6, row.y + row.height - 6);
    await expect(page.getByText("Comparing 2 series")).toBeVisible();
    expect(search(page)).toBe("?series=A-0001,A-0013");

    // The name still shows that series on its own.
    await page
      .getByRole("row", { name: /Summit Software/ })
      .getByText("Summit Software (SUMS)")
      .click();
    await expect(page).toHaveURL(/\?series=A-0020$/);
  });

  test("every chart follows the page's range: the wheel scrolls the page instead of zooming a chart", async ({
    page,
  }) => {
    await page.goto("/alpha?series=A-0001");
    await waitForCharts(page);
    const price = page.getByRole("region", { name: "Price" });
    const firstLabel = () => price.locator(".highcharts-xaxis-labels").first().locator("text").first().textContent();
    const before = await firstLabel();

    const plot = (await price.locator(".highcharts-plot-background").first().boundingBox())!;
    await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await firstLabel()).toBe(before); // not zoomed

    // A range chosen for the page reaches this chart too.
    await page.getByRole("radio", { name: "Last 3 months" }).click();
    await expect.poll(firstLabel).not.toBe(before);
  });

  test("compares series rebased to 100", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=3M");
    await waitForCharts(page);
    // React Aria visually hides the native input; users click the visible label.
    await page.locator("label", { has: page.getByRole("checkbox", { name: /^Compare Lumen Technologies/ }) }).click();
    await expect(page.getByText("Comparing 2 series")).toBeVisible();
    await expect(page.getByRole("region", { name: "Price" }).getByText(/indexed to 100/)).toBeVisible();
  });

  test("dragging the navigator's period sets every panel's range, once, on release", async ({ page }) => {
    await page.goto("/alpha?series=A-0001");
    await waitForCharts(page);
    const navigator = page.getByRole("group", { name: "Time range for Acme Corp (ACMC)" });
    const period = navigator.locator(".highcharts-navigator-mask-inside");
    await expect(period).toBeVisible();
    const box = (await period.boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 10 });
    // Nothing reloads mid-drag: the panels and the URL wait for the release.
    expect(page.url()).not.toContain("from=");
    await page.mouse.up();

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    const to = new URL(page.url()).searchParams.get("to") as string;
    expect(to < "2025-12-01").toBe(true);
    await expect(navigator.getByText(/data points/)).not.toContainText("to 31 Dec 2025");
  });

  test("the wheel over the navigator zooms the page's range around the pointer", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=1Y");
    await waitForCharts(page);
    const navigator = page.getByRole("group", { name: "Time range for Acme Corp (ACMC)" });
    const period = (await navigator.locator(".highcharts-navigator-mask-inside").boundingBox())!;
    // Pointer on the period's right end (its grip): zooming in keeps the end where it is.
    await page.mouse.move(period.x + period.width + 2, period.y + period.height / 2);
    await page.mouse.wheel(0, -300);

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=2025-12-31/);
    expect(daysShown(page.url())).toBeLessThan(200);
    await expect(navigator.getByText(/data points/)).not.toContainText("31 Dec 2024");
    expect(await page.evaluate(() => window.scrollY)).toBe(0); // the wheel zoomed; it didn't scroll

    // Shift + wheel moves the period back in time, keeping its length.
    const zoomed = daysShown(page.url());
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, -400);
    await page.keyboard.up("Shift");
    await expect(page).not.toHaveURL(/to=2025-12-31/);
    expect(Math.abs(daysShown(page.url()) - zoomed)).toBeLessThanOrEqual(1);
  });

  test("dragging a chart pans every panel, once, on release", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=3M");
    await waitForCharts(page);
    const plot = (await page
      .getByRole("region", { name: "Price" })
      .locator(".highcharts-plot-background")
      .first()
      .boundingBox())!;
    const y = plot.y + plot.height / 2;
    await page.mouse.move(plot.x + plot.width / 3, y);
    await page.mouse.down();
    await page.mouse.move(plot.x + plot.width / 3 + 300, y, { steps: 10 });
    // The charts move live; the URL and the data wait for the release.
    expect(page.url()).not.toContain("from=");
    await page.mouse.up();

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    expect(new URL(page.url()).searchParams.get("to")! < "2025-12-31").toBe(true);
    // Another panel follows: its latest value is from before the old end.
    const flow = page.getByRole("region", { name: "Net order flow" });
    await expect(flow.locator("header")).not.toContainText("31 Dec 2025");
  });

  test("Ctrl + wheel (a trackpad pinch) zooms a chart's range; a sideways swipe pans it", async ({ page }) => {
    await page.goto("/alpha?series=A-0001&range=1Y");
    await waitForCharts(page);
    const plot = (await page
      .getByRole("region", { name: "Price" })
      .locator(".highcharts-plot-background")
      .first()
      .boundingBox())!;
    await page.mouse.move(plot.x + plot.width / 2, plot.y + plot.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Control");
    await expect(page).toHaveURL(/from=/);
    const zoomed = daysShown(page.url());
    expect(zoomed).toBeLessThan(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const to = new URL(page.url()).searchParams.get("to")!;
    await page.mouse.wheel(-300, 0);
    await expect.poll(() => new URL(page.url()).searchParams.get("to")! < to).toBe(true);
    expect(Math.abs(daysShown(page.url()) - zoomed)).toBeLessThanOrEqual(1);
  });

  test("the navigator's keyboard controls drive every panel", async ({ page }) => {
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
    // The first drawing is the chart; the navigator under it is the second.
    await expect(score.locator(".highcharts-root").first()).toBeVisible();
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

/** Days from the URL's `from` to its `to`. */
function daysShown(url: string): number {
  const params = new URL(url).searchParams;
  return (Date.parse(params.get("to")!) - Date.parse(params.get("from")!)) / 86_400_000;
}
