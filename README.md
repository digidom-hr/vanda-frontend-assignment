# Timeseries dashboard

A multi-page chart dashboard for analysts, built on the three mock data services. One page per service with several chart panels, a global search across every service, and transforms you can chain on any series.

**Live:** https://vanda-frontend-assignment.vercel.app

The original brief is in [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Run it

Requires Node.js 20.9 or newer.

```sh
npm install
npm start
```

`npm start` builds the app (about a minute the first time), then starts the unchanged mock API on port 4000 and the app on **http://localhost:3000**.

| Command            | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `npm run dev`      | Mock API and the app in development mode, with hot reload           |
| `npm run verify`   | Type check, lint, format check and unit tests (the pre-commit gate) |
| `npm run test:e2e` | Builds, then runs the Playwright journeys and accessibility audits  |
| `npm run api`      | The mock API alone (unchanged from the starter)                     |

The app reads the API's address from `MOCK_API_URL` (default `http://localhost:4000`; see [.env.example](.env.example)). The first end-to-end run needs the test browser: `npx playwright install chromium`.

## What's in it

- **One route per service:** `/alpha`, `/bravo`, `/charlie`. Each page has a series picker, a time rail, frequency and range controls, and the panels that suit that service's data:
  - **Alpha (equities):** price, net order flow, score, momentum, and rank among the 40 companies.
  - **Bravo (investor flows):** net flow, gross flow, cumulative net flow, and net as a share of gross. USD and basis-point series never share an axis.
  - **Charlie (composite scores):** the score with labelled high and low thresholds, plus a signal board of every series' latest reading, grouped by category.
- **Global search** in the header of every page (press <kbd>/</kbd>). It returns results from all services in one list, and choosing one opens that service's page with the series selected.
- **Transforms** on the main panel: moving average, rolling sum, percent change, cumulative and z-score (over the whole history or a rolling window). They can be chained, for example `MA(20) then % change`, and the axis unit follows.
- **Compare** up to six series, rebased to 100 at the start of the visible range, so series of different size are readable on one axis.
- **Shareable views:** series, frequency, range and transforms live in the URL. Reload, Back and Forward, and sending a link all keep the view.
- **Light and dark themes,** following the system setting by default, and a layout that works from phone to wide desktop.

## Architecture

```
Browser: React, TanStack Query (cache, retries), URL state
   │  /api/...
   ▼
Next.js route handlers: a thin backend-for-frontend inside the app
   │  validate → read all pages in parallel → normalise → trim fields
   ▼
Mock API (unchanged)
```

| Folder            | Contents                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `src/app/`        | Pages (`/`, `/[service]`) and API routes (`/api/...`)                                                   |
| `src/services/`   | One folder per data service: metadata, upstream adapter, page definition                                |
| `src/server/`     | Server-only code: upstream client, catalog cache, error mapping ([why it exists](src/server/README.md)) |
| `src/lib/`        | Plain TypeScript: transforms, search ranking, URL state rules, formatting                               |
| `src/components/` | UI: shell, search, charts, panels, controls, the generic service dashboard                              |
| `src/styles/`     | `tokens.css` holds the whole visual language; components only use its variables                         |

### Adding a service

The brief says more services will follow, so that's the main seam. A new service is a folder in `src/services/<id>/` with three files:

- `meta.ts`: its name, fields, units and frequencies. Browser-safe.
- `adapter.ts`: validates the upstream payloads and converts them to the shared shape. Server-only.
- `dashboard.ts`: its page, declared as a list of panels built from shared presets.

Then add one entry each to the registry, `ADAPTERS` and `DASHBOARDS`. Those maps are typed `Record<ServiceId, …>`, so a service that is registered but missing a piece **fails to compile**. Routes, navigation, search and the API pick it up from the registry.

### Key decisions

- **A small server layer, not direct calls from the browser.** The mock API pages its results (one intraday series is 11 pages), sends every field as row objects, has three row shapes, and searches differently in each service. The route handlers read pages in parallel, validate with zod, and return only the requested fields as columns. Responses are 3–11× smaller, and the UI handles one data shape and one error format. The trade-off and the browser-only alternative are in [src/server/README.md](src/server/README.md).
- **One search, ranked by us.** Merging three upstream searches can't produce one sensible order, so search runs over the cached catalogs with one ranking:
  1. exact id
  2. id prefix
  3. name starts with the query
  4. every word in the name
  5. a facet match, such as a sector or region

  Within a tier, results sort by name. One entity's series from different services land together, for example "Acme Corp (ACMC)" and "Acme Corp Composite".

- **The URL holds view state, and TanStack Query holds server data.** There's no global store. A search result is just a link.
- **Transforms run in the browser** on data already fetched, so changing a window is instant. They're pure functions with the edge cases handled:
  - warm-up periods are gaps, never zeros;
  - percent change uses the absolute base, so flows that go negative get the right sign;
  - z-scores centre the values before squaring, so very large values stay precise.
- **Highcharts Stock** draws the charts and is loaded only on chart pages. The colours were checked for colour-vision deficiency and contrast in both themes. The chart is never the only way to read the data: every chart has a table view.
- **React Aria Components** provides the complex widgets (combobox, popovers, sliders), styled with CSS Modules and design tokens.

### Large, slow or unavailable data

- **Large.** Five-minute data is requested only for the visible window, and only the fields each panel draws. A response budget returns a clear "choose a shorter range" message instead of an oversized payload. One notice per page offers a one-click fix.
- **Slow.** Requests time out and retry with backoff, on the server and again in the browser. Previous data stays on screen, dimmed, while new data loads. After five seconds, the page explains the wait.
- **Unavailable.** Each panel fails on its own, with a Retry button. Search still returns the services that answered and names the one that didn't. The server keeps serving the last good catalog during an outage. Errors are never cached.

## Quality

- **Tests:**
  - 390 unit and component tests (Vitest, Testing Library, and MSW for network fakes);
  - 35 end-to-end tests (Playwright) against the real app and the unchanged mock API, on desktop and phone sizes, including simulated outages;
  - axe accessibility audits of every page in light and dark mode.
- **CI:** GitHub Actions runs `verify` and the end-to-end suite on every pull request and on `main`.
- **Accessibility:**
  - keyboard access throughout, with visible focus and a skip link;
  - screen-reader labels and announcements;
  - 24 px minimum targets, and larger ones on touch screens;
  - reduced motion respected;
  - signals shown as a shape and a word, never colour alone;
  - a table view for every chart.
- **Strict TypeScript,** with `noUncheckedIndexedAccess` and related flags. Dependencies are pinned to exact versions.

## Deployment

- **The app** runs on **Vercel**; its server code is pinned to Frankfurt (`fra1`) by [vercel.json](vercel.json).
- **The mock API** runs unchanged on **Render**, defined in [render.yaml](render.yaml). It's a long-running server that loads 52 MB of data at startup, which doesn't fit Vercel's short-lived functions.
- **Both are in Frankfurt,** next to each other and close to London.

The API is on Render's **free plan**, which sleeps after 15 idle minutes and takes about a minute to wake. Three things soften that:

1. An external monitor ([UptimeRobot](https://uptimerobot.com)) requests `/charlie/latest` every 5 minutes, so the API normally doesn't sleep.
2. The app starts loading every catalog as soon as a page opens, so a sleeping API starts waking right away.
3. Retries outlast a wake, and the page explains the wait.

**Switching to an always-on API:** set `plan: starter` in `render.yaml` and delete the monitor. Nothing else changes.

## Known limitations

- **Bundle size.** Highcharts adds about 300 KB to the chart pages. It's lazy-loaded; trimming it to the Stock modules in use is the next step if size matters.
- **Catalog cache.** It's per server instance. That's fine for catalogs this small; a shared cache would be the next step if they grow.
- **No fuzzy matching.** Search matches whole words and prefixes, without typo tolerance.
- **`npm audit` warnings.** It reports 5 high-severity warnings, all from `braces` inside ESLint's dev tooling. No fixed version exists, and the code never ships to the browser or server.
- **TypeScript is pinned to 6.0.** typescript-eslint doesn't support TypeScript 7 yet.
