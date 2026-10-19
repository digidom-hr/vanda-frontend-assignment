// Mock API. Zero dependencies. Usage: node mock-api/server.mjs (PORT defaults to 4000)
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const load = (name) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), "utf8"));
const DATA = { alpha: load("alpha"), bravo: load("bravo"), charlie: load("charlie") };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Latest row per charlie series.
const latest = new Map();
for (const row of DATA.charlie.rows.daily) latest.set(row.series_id, row);

// Each service searches and orders results by its own rules.
const SEARCH = {
  alpha: (series, q) =>
    series.filter((s) => `${s.name} ${s.series_id}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)),
  bravo: (series, q) => {
    const tokens = words(q);
    return series.filter((s) => {
      const hay = words(`${s.name} ${s.region} ${s.category}`);
      return tokens.every((t) => hay.some((w) => w.startsWith(t)));
    });
  },
  charlie: (series, q) => {
    const tokens = words(q);
    return series
      .filter((s) => words(s.name).some((w) => tokens.some((t) => w.startsWith(t))))
      .sort((a, b) => Math.abs(latest.get(b.series_id).value) - Math.abs(latest.get(a.series_id).value));
  },
};

function intParam(params, key, fallback, max = Infinity) {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, `${key} must be a positive integer`);
  return Math.min(n, max);
}

function paginate(items, params, defaultSize) {
  const page = intParam(params, "page", 1);
  const page_size = intParam(params, "page_size", defaultSize, 10000);
  const total_pages = Math.max(1, Math.ceil(items.length / page_size));
  return {
    data: items.slice((page - 1) * page_size, page * page_size),
    pagination: { page, page_size, total_pages, has_next: page < total_pages },
  };
}

function listSeries(service, params) {
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const series = DATA[service].series;
  return paginate(q ? SEARCH[service](series, q) : series, params, 25);
}

function timeseries(service, params) {
  const { series, rows } = DATA[service];
  const ids = (params.get("series_ids") ?? "").split(",").filter(Boolean);
  if (!ids.length) throw new HttpError(400, "series_ids is required");
  const known = new Set(series.map((s) => s.series_id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw new HttpError(404, `unknown series_ids: ${unknown.join(",")}`);

  const frequency = params.get("frequency") ?? Object.keys(rows)[0];
  if (!rows[frequency]) throw new HttpError(400, `frequency must be one of: ${Object.keys(rows).join(", ")}`);

  const wanted = new Set(ids);
  const start = params.get("start_date") ?? "";
  const end = params.get("end_date") ?? "9999-12-31";
  const filtered = rows[frequency].filter((r) => wanted.has(r.series_id) && r.ts.slice(0, 10) >= start && r.ts.slice(0, 10) <= end);
  return paginate(filtered, params, 5000);
}

function charlieLatest(params) {
  const { data, pagination } = listSeries("charlie", params);
  return {
    data: data.map((s) => {
      const { ts, value, unit } = latest.get(s.series_id);
      return { series_id: s.series_id, name: s.name, category: s.category, ts, value, unit, signal: value >= 1 ? "high" : value <= -1 ? "low" : "mid" };
    }),
    pagination,
  };
}

const ROUTES = {
  "/series": (svc, p) => listSeries(svc, p),
  "/timeseries": (svc, p) => timeseries(svc, p),
};

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const [, service, ...rest] = url.pathname.split("/");
  let status = 200;
  let body;
  try {
    if (req.method !== "GET") throw new HttpError(405, "GET only");
    const route = `/${rest.join("/")}`;
    if (service === "charlie" && route === "/latest") body = charlieLatest(url.searchParams);
    else if (DATA[service] && ROUTES[route]) body = ROUTES[route](service, url.searchParams);
    else throw new HttpError(404, "not found");
  } catch (err) {
    status = err instanceof HttpError ? err.status : 500;
    body = { error: err.message };
  }
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}).listen(process.env.PORT ?? 4000, () => console.log(`Mock API on http://localhost:${process.env.PORT ?? 4000}`));
