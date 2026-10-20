import { expect, type Page } from "@playwright/test";

/** Waits until the page's first chart has drawn. */
export async function waitForCharts(page: Page): Promise<void> {
  await expect(page.locator(".highcharts-root").first()).toBeVisible({ timeout: 20_000 });
}

/** The query string of the current URL, decoded. */
export function search(page: Page): string {
  return decodeURIComponent(new URL(page.url()).search);
}
