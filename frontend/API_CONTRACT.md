# IGM Frontend ↔ Backend API Contract

The frontend (Vite + React + TS) is a single-page app served on `:5173` during
dev. It talks to the local Python backend on `:8765`. Vite proxies `/api/*` to
the backend during dev, so the same paths work in production when the backend
serves the built bundle.

**Authoritative TypeScript types live in `src/types.ts`.** This document mirrors
them in prose form for the backend (codex) to implement against.

---

## Conventions

- All request and response bodies are JSON.
- Timestamps are ISO 8601 strings (UTC or local, but consistent — frontend uses
  the user's local timezone for display).
- All numeric counts are integers unless otherwise noted (`zero_card_rate`,
  `city_confidence`, etc. are floats in `[0, 1]`).
- Empty optional fields are `null`, never absent. (Easier on TS.)
- The backend returns HTTP error status + a `{ error: string, code?: string }`
  body on failure. Frontend currently surfaces these as unhandled toasts — fine
  for POC.

---

## Endpoints

### `GET /api/dashboard`
The single payload that powers `/` (the operator dashboard). Refreshed every 5s.
Should be cheap to compute — back it with one or two SQL queries against the
`runs`, `run_events`, `crawl_queue`, and `people` tables.

```ts
interface DashboardPayload {
  server_time: string              // ISO, used to anchor relative times
  uptime_ms: number                // backend process uptime
  current_or_last_run: RunSummary
  queue: QueueSummary
  graph: GraphTotals
  alerts: Alert[]                  // empty array if nominal
  recent_events: RunEvent[]        // up to 50, newest first
}
```

**`RunSummary`** — if a run is in progress, return that one; otherwise the last
finished/blocked/killed run.

```ts
interface RunSummary {
  id: number
  started_at: string
  ended_at: string | null          // null while running/paused
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'killed' | 'paused'
  profile_loads: number
  load_budget: number              // the cap chosen on run start
  qualifying_added: number         // people added that pass the *default* filter
  new_people_added: number         // all people added this run, qualifying or not
  zero_card_rate: number           // 0..1, panels-with-zero-cards / total-panels this run
  zero_card_baseline: number       // 0..1, rolling 30d baseline
  latency_p50_ms: number           // profile load latency, this run
  latency_p95_ms: number
  latency_p50_baseline_ms: number  // rolling 30d baseline
  latency_p95_baseline_ms: number
  latency_sparkline: number[]      // last ~40 p95 samples (single-page load times also fine), for the trend line
  challenges_24h: number           // count of /challenge/ redirects in last 24h
  rate_limits_24h: number          // count of 429s in last 24h
  macro_breaks: number             // count of long sleeps taken this run
  macro_break_ms_total: number     // total ms spent in macro breaks this run
  block_reason: string | null      // human-readable, populated when blocked/paused
}
```

**`QueueSummary`** — `crawl_queue` aggregation.

```ts
interface QueueSummary {
  pending: number
  in_flight: number
  done: number
  skipped: number
  error: number
  stuck_username: string | null    // populated if an in_flight row > 5 min old
}
```

**`GraphTotals`** — `people` aggregation.

```ts
interface GraphTotals {
  total_people: number
  with_bio_geo: number             // city_source = 'bio' OR 'manual'
  with_inferred_geo: number        // city_source = 'inferred'
  blr_candidates: number           // city = 'bangalore' regardless of source
  qualifying_default: number       // people passing the default filter (see §13.3 in DESIGN.md)
}
```

**`Alert`** — populated by the detection layer in §4.4 and §15.

```ts
interface Alert {
  id: string
  severity: 'warning' | 'critical'
  title: string
  detail: string
  raised_at: string
}
```

Alert raising rules (backend-side):
- **critical**: any `/challenge/` in 24h; any 429 in 24h; zero_card_rate >15% with ≥10 panels this run; in_flight row stuck >5 min
- **warning**: latency_p95 > 2× baseline; macro_break ratio departing from norm

**`RunEvent`** — last 50 rows from `run_events`.

```ts
interface RunEvent {
  ts: string
  kind: 'load' | 'skip' | 'add' | 'pause' | 'block' | 'challenge' | '429' | 'macro_break' | 'queue' | 'error'
  payload: string                  // free-form one-liner — frontend renders verbatim
}
```

---

### `POST /api/runs/start`
Starts a new crawl run. Returns immediately; the run executes async. Frontend
polls `/api/dashboard` to observe progress.

Request:
```ts
interface StartRunRequest { load_budget: number }  // 20..140
```

Response:
```ts
interface StartRunResponse { run_id: number; status: 'running' }
```

Errors:
- `409 { error: "run_in_progress", run_id }` — only one run at a time
- `423 { error: "blocked", until: ISO }` — backend is in a forced cool-down (recent challenge/429)

---

### `POST /api/runs/{id}/stop`
Gracefully halts the run. Marks it `killed` if forced, `completed` if it was
mid-iteration. Idempotent — calling on a finished run returns 200.

Response: `204 No Content`.

---

### `GET /api/candidates`
Paginated candidate listing. Backend applies the filter; frontend does NOT
re-filter (the local mock does, but real backend should be authoritative).

Query params (all optional):
```ts
interface CandidateFilters {
  min_followers?: number
  min_mutuals?: number
  city?: string | 'any'
  include_inferred?: boolean
  inferred_confidence_min?: number   // 0..1
  name_fuzzy_min?: number            // 50..100, applied as: max(name_match score for this person) >= this
  status?: 'unreviewed' | 'saved' | 'dismissed' | 'followed' | 'all'
  sort?: 'mutuals_desc' | 'followers_desc' | 'name_match_desc' | 'recency_desc'
  limit?: number                     // default 100
  cursor?: string                    // opaque, returned as next_cursor
}
```

Response:
```ts
interface CandidatesResponse {
  results: Candidate[]
  total: number                      // total matching, not page size
  next_cursor: string | null
}

interface Candidate {
  username: string
  full_name: string | null
  bio: string | null
  followers_count: number
  following_count: number
  external_url: string | null
  is_verified: boolean
  is_private: boolean
  mutuals_with_me: number
  city: string | null                // e.g. 'bangalore'
  city_source: 'bio' | 'inferred' | 'manual' | null
  city_confidence: number | null     // 0..1
  name_matches: NameMatch[]
  status: 'unreviewed' | 'saved' | 'dismissed' | 'followed'
  first_seen_at: string
  suggested_by: { username: string; full_name: string | null }[]
}

interface NameMatch { pattern: string; score: number }
```

---

### `PATCH /api/candidates/{username}`
Update the operator's review status for a candidate. Single field for now.

Request:
```ts
{ status: 'unreviewed' | 'saved' | 'dismissed' | 'followed' }
```

Response: `204 No Content`.

---

### `GET /api/graph?limit=500`
Node/edge list for the graph explorer. `limit` is advisory — backend should
return the most "interesting" subgraph if total exceeds it (suggestion: highest
follower count + their immediate neighbors).

Response:
```ts
interface GraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode {
  id: string                         // username, used as node id
  full_name: string | null
  followers: number
  city: string | null
  city_source: 'bio' | 'inferred' | 'manual' | null
  is_seed: boolean                   // true if this is one of my direct followers
}

interface GraphLink {
  source: string                     // node id
  target: string
  kind: 'follows' | 'suggested'
  weight: number | null              // for 'suggested': mutual count
}
```

---

### `GET /api/names`
Read the current names.txt patterns plus a precomputed match count.

Response:
```ts
interface NamesPayload {
  patterns: string[]                 // one entry per line
  match_count: number                // people in DB matching at least one pattern at score >= 80
}
```

### `PUT /api/names`
Replace the patterns. Backend writes `names.txt` and re-runs the fuzzy match
job, returning updated `match_count`.

Request:
```ts
{ patterns: string[] }
```

Response: same shape as `GET /api/names`.

---

### `GET /api/events?since=<iso>` (optional, recommended)
Server-Sent Events stream of new `RunEvent`s as they happen. Frontend can fall
back to polling `/api/dashboard` if this isn't implemented.

```
event: run_event
data: { "ts": "...", "kind": "add", "payload": "..." }

event: alert
data: { "id": "...", "severity": "critical", ... }

event: heartbeat
data: { "ts": "..." }
```

---

## Suggested backend stack (per DESIGN.md)

- FastAPI on `:8765`, single process. ASGI.
- The crawl loop runs in a background task (or separate process) and writes to
  the same SQLite DB; the API server reads.
- WAL mode on SQLite so the API server can read while the crawler writes.
- The frontend dev server proxies `/api/*` to `:8765` — see `vite.config.ts`.
  For production-ish use, serve the Vite-built `dist/` from FastAPI directly.

## Mocks

`src/lib/mock.ts` produces three toggleable dashboard states (nominal, running,
alerting) and a small in-memory candidates/graph dataset. The top-bar scenario
switch reloads the page after persisting the choice to localStorage. Set
`USE_MOCKS = false` in `src/lib/api.ts` once the backend is reachable.
