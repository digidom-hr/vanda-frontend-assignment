# Mock API Reference

Base URL: `http://localhost:4000`. All endpoints are `GET` and return JSON.
Dates are `YYYY-MM-DD`. Timestamps are UTC. Errors return `{ "error": "message" }`.

## Conventions (all services)

**List series:** `GET /{service}/series`

| Param | Type | Description |
|---|---|---|
| `q` | string | Free-text search |
| `page` | integer | Starts at 1 |
| `page_size` | integer | Default 25 |

**Get data:** `GET /{service}/timeseries`

| Param | Type | Description |
|---|---|---|
| `series_ids` | string | Comma-separated. Required. |
| `frequency` | string | One of the series' `frequencies`. Defaults to the first. |
| `start_date` | date | Inclusive |
| `end_date` | date | Inclusive |
| `page` | integer | Starts at 1 |
| `page_size` | integer | Default 5000, max 10000 |

**Response envelope**

```json
{
  "data": [],
  "pagination": { "page": 1, "page_size": 25, "total_pages": 1, "has_next": false }
}
```

Services: `alpha`, `bravo`, `charlie`. They share the conventions above.
The shape of each series object and of each row in `data` is service-specific.

---

## alpha

### `GET /alpha/series`

```json
{
  "series_id": "A-0001",
  "name": "Acme Corp (ACMC)",
  "group": "Technology",
  "frequencies": ["daily", "5min"],
  "unit": "USD"
}
```

### `GET /alpha/timeseries`

`frequency` is `daily` or `5min`. For `5min`, `ts` is a full timestamp (`2025-03-03T14:30:00Z`).

```json
{
  "ts": "2025-03-03",
  "series_id": "A-0001",
  "price": 182.4,
  "price_change": 0.6,
  "buy_value": 12000000,
  "sell_value": 11000000,
  "net_value": 1000000,
  "total_value": 23000000,
  "group_net_value": 210000,
  "score": 0.8,
  "momentum": 1.4,
  "rank": 112
}
```

---

## bravo

### `GET /bravo/series`

```json
{
  "series_id": "B-0101",
  "name": "North America Retail Activity",
  "region": "North America",
  "category": "Retail",
  "metrics": ["net", "gross"],
  "frequencies": ["daily", "weekly", "monthly"],
  "unit": "USD"
}
```

### `GET /bravo/timeseries`

`frequency` is `daily`, `weekly` or `monthly`. There is one row per metric per timestamp.

```json
{
  "ts": "2025-03-03",
  "series_id": "B-0101",
  "metric": "net",
  "frequency": "daily",
  "value": 1250000,
  "unit": "USD"
}
```

---

## charlie

### `GET /charlie/series`

```json
{
  "series_id": "C-0001",
  "name": "North America Equity Composite",
  "category": "equity",
  "frequencies": ["daily"],
  "unit": "score"
}
```

### `GET /charlie/timeseries`

```json
{ "ts": "2025-03-03", "series_id": "C-0001", "value": 0.47, "unit": "score" }
```

### `GET /charlie/latest`

Latest value per series, with a signal. Takes `q`, `page` and `page_size` like any list endpoint.

```json
{
  "series_id": "C-0001",
  "name": "North America Equity Composite",
  "category": "equity",
  "ts": "2025-12-31",
  "value": 0.47,
  "unit": "score",
  "signal": "mid"
}
```

`signal` is one of `high`, `mid` or `low`.
