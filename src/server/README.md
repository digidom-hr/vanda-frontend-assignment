# Server layer (backend for frontend)

Code in `src/server/` and `src/app/api/` runs only on the server, inside the
Next.js app. The browser never calls the mock API directly: it calls this
app's own `/api/...` routes, which call the mock API.

This is a deliberate choice, not a requirement. The mock API sends permissive
CORS headers, so the browser *could* call it directly. We keep a thin
server layer, owned by the frontend team, because of what the data looks like:

| Concern | Without this layer | With it |
|---|---|---|
| Pagination | The browser loops over pages (11 requests for one 5-minute series) | One request; pages are read in parallel server-side |
| Payload | Raw rows: about 24 MB for the 5-minute series | Columnar, only the requested fields: 3–6x smaller |
| Data shapes | Every component handles three row formats | One shape (`SeriesColumns`), validated once |
| Search | Three services that match and sort differently | One matcher and ranking over cached catalogs |
| Failures | Each component interprets upstream errors | Typed errors, one response format, stale catalogs served during outages |
| More services | Logic spread across the UI | One folder per service plus a registry entry |

## Trade-offs

- More code and one more network hop (fast, since it's the same host locally and the same region in deployment).
- On Vercel, responses are capped at 4.5 MB, so timeseries responses carry a
  size budget (`MAX_POINTS_PER_RESPONSE`) and the UI requests date ranges and
  fields rather than whole histories.
- The catalog cache is per server instance; CDN caching via `Cache-Control`
  sits on top of it.

## If this layer were removed

Most of the logic is not server-specific and would move into the browser
unchanged: `src/lib/search.ts` (ranking), the service adapters (validation and
normalisation) and `src/lib/transforms/`. The server-only parts are the HTTP
client with retries (`upstream.ts`), the catalog cache (`catalog.ts`) and the
route handlers.

## Map

- `upstream.ts`: HTTP client: timeouts, retries, parallel pagination, size guard
- `adapter-kit.ts`, `adapters.ts`: per-service validation and normalisation (adapters live in `src/services/<id>/`)
- `catalog.ts`: cached series catalogs, shared by routes and search
- `timeseries.ts`, `search.ts`: request validation and the logic behind each route
- `http.ts`, `errors.ts`: typed errors and how they map to HTTP responses
