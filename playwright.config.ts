import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real app: the production build and the
 * unchanged mock API, started the same way `npm start` runs them.
 * Run with `npm run test:e2e` (it builds first).
 */
const WEB_PORT = 3210;
const API_PORT = 4000;

/**
 * Every test starts with the onboarding tour already seen, so it doesn't
 * cover the page; the tour's own tests start from a clean state.
 */
const TOUR_SEEN = {
  cookies: [],
  origins: [
    {
      origin: `http://localhost:${WEB_PORT}`,
      localStorage: [{ name: "vanda-timeseries:tour", value: "done" }],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: TOUR_SEEN,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      // Journeys that differ on phones, plus the accessibility scans.
      grep: /@mobile|@a11y/,
    },
  ],
  webServer: [
    {
      command: "npm run api",
      url: `http://localhost:${API_PORT}/alpha/series`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { MOCK_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
