# Instagram Graph Scrape — Design Doc

## 1. Product vision

A "friends-of-friends intro" layer to combat loneliness. The user opens the app, sees 2nd-degree connections filtered by city / interest / fuzzy-name list, and can request an intro routed through the mutual friend. The graph crawler in this repo is the data substrate; the matching + intro UX is downstream.

**This doc covers the MVP**: a single-user crawler running on a secondary IG account, building a SQLite graph of 2nd-degree candidates filtered to Bangalore + ≥4 mutuals + ≥200 followers, with a global cap of **30 qualifying candidates per run**.

## 2. Non-goals (MVP)

- Multi-tenant auth. One operator, one logged-in browser.
- Following / messaging / any write action on IG. Read-only crawl.
- Going past 2nd degree. (Each run extends the frontier, but no recursive deepening within a run.)
- Real-time updates. Nightly batch is fine.
- Paid APIs for geo (SerpAPI etc.) — we infer from bio + neighborhood.

## 3. System overview

```
+---------------------+
|  real Chrome (CDP)  |  ← user logs in once on secondary account
|  --remote-debug...  |
+----------+----------+
           │ (Playwright attaches)
+----------v----------+
|   browser harness   |  pacing, stealth, checkpoint detection
+----------+----------+
           │
+----------v----------+
|   page adapters     |  followers list, profile, suggestions panel
+----------+----------+
           │  raw records
+----------v----------+
|  traversal engine   |  BFS queue, global-30 cap, filter pipeline
+----------+----------+
           │
+----------v----------+
|   storage (SQLite)  |  people, edges, queue, runs
+----------+----------+
           │
+----------v----------+
|  enrichment (async) |  geo bio-scan, geo neighbor-propagation,
|  + fuzzy-name match |  name fuzzy match against user's list
+---------------------+
```

Each box is one module; modules talk only through SQLite + a small in-process message bus. Crawler can be killed and resumed at any time without losing work.

## 4. Browser harness

### 4.1 Connection mode

Attach Playwright to a Chrome instance the user starts manually:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.ig-scrape-chrome-profile"
```

The user logs into the **secondary** IG account once in that Chrome window. Playwright connects via `browser = await playwright.chromium.connect_over_cdp("http://localhost:9222")`. Traffic looks indistinguishable from manual browsing — same TLS fingerprint, same Chrome version, same cookies, same extensions.

Tradeoff: that Chrome window is "owned" by the crawler while running; user shouldn't browse IG in it concurrently.

### 4.2 Anti-detection layer

Even with real Chrome, IG fingerprints behavioral patterns. Mitigations:

- **No `webdriver` flag** — CDP-attach avoids the `navigator.webdriver` tell that `playwright.launch()` sets.
- **Human input** — every interaction goes through a small `human.py` helper:
  - `human.click(locator)` → mouse-move along bezier curve to element, dwell 200-800ms, click
  - `human.scroll(distance)` → wheel events with momentum, not `scrollTo`
  - `human.type(text)` → keystrokes with 80-220ms jitter
- **Read-don't-click where possible** — extract from DOM rather than clicking through. Less interaction = less surface to fingerprint.
- **Viewport/UA**: inherited from real Chrome, so no spoofing needed.

### 4.3 Pacing

The single biggest ban vector. Concrete budget:

| Action | Min delay | Distribution | Notes |
|---|---|---|---|
| Profile page load → next | 12s | log-normal(μ=ln18, σ=0.45) | ~80% land in 12-30s |
| Suggestions panel open | 2s | uniform(2, 5) | feels like reading |
| Followers-list scroll tick | 4s | uniform(4, 9) | per ~20 rows loaded |
| Inter-follower (after one full profile + panel) | +5s | uniform(5, 15) added on top | natural |

**Hourly cap**: 35 profile visits.
**Daily cap**: 140 profile visits.
**Macro breaks**: every 18-25 profile visits, sleep `uniform(6, 14)` minutes. Every ~3 hours, sleep `uniform(40, 90)` minutes.
**Diurnal pattern**: don't crawl 02:00-07:00 IST. Light activity 22:00-02:00, heavy 10:00-22:00.

Total realistic candidates added per day: ~30 (one run) to ~90 (three runs) depending on filter hit rate.

### 4.4 Checkpoint / rate-limit detection

After every navigation, check for:
- URL redirect to `/challenge/` or `/accounts/login/` → **hard stop**, mark run as `blocked`, notify operator.
- HTTP 429 or 5xx via response listener → backoff 30 min, then retry once; second failure stops the run.
- "Try again later" toast (DOM text scan) → soft block, sleep 2h.
- Suggestions panel returns 0 cards on 3+ consecutive profiles → likely throttled, stop.

Each stop writes a `run_events` row with the cause so we can tune pacing from data.

## 5. Page adapters

Three pages, three adapters. Each returns typed records, no side effects.

### 5.1 `followers_list_adapter`
- Input: a profile's `/{username}/followers/` modal
- Output: `[(username, full_name, is_verified), ...]`
- Strategy: scroll the dialog incrementally, scrape each row as it virtualizes in, dedupe by username. Stop when bottom sentinel reached or after N rows.

### 5.2 `profile_adapter`
- Input: `/{username}/`
- Output: `Profile(username, full_name, bio, followers_count, following_count, posts_count, is_private, external_url)`
- Read counts from the header. Bio from the `<h1>` sibling. Private account → skip suggestions.

### 5.3 `suggestions_panel_adapter`
- Input: profile page with panel
- Behavior:
  1. Find the chevron button next to "Following"/"Follow" (`svg[aria-label="Similar accounts"]` or current equivalent — this selector drifts, isolate it).
  2. If `aria-expanded="false"`, click via `human.click`. If already expanded, skip.
  3. Read carousel cards. Each card has `username`, `full_name`, mutual-text ("Followed by X, Y and 3 others"), follower count is NOT in the card (need a profile visit to confirm).
- Output: `[SuggestionCard(username, full_name, mutual_text), ...]`

Mutual count parsing: count comma-separated names in "Followed by …" + parse the trailing "and N others" if present. If text is "Followed by X" only → 1 mutual.

## 6. Traversal engine

The crawler is intentionally dumb: scrape broadly, store everything, decide later. Mutuals / geo / name / fuzzy filtering all happen post-hoc against the DB. This keeps the in-loop decision tree small (less to fingerprint), and lets us re-query with new thresholds without re-crawling.

### 6.1 Seeds
First run: seed queue with the user's secondary-account followers, plus the user's **main account's followers** (main is public → scrape-able from the burner). The main's followers list is also the **exclusion set** for surfaced candidates (no point recommending people who already follow you).

### 6.2 Loop (crawler — no mid-run filtering beyond cheap pre-filter)

```
while profile_loads_this_run < LOAD_BUDGET and not blocked:
    follower = queue.pop_next(status='pending')
    profile = profile_adapter.fetch(follower.username)        # +1 load
    profile_loads_this_run += 1
    if profile.is_private or profile.followers_count < 200:
        queue.mark(follower, 'skipped'); continue

    cards = suggestions_panel_adapter.fetch(profile)
    for card in cards:
        if exclusion_check(card.username):  # in main's followers OR already in graph
            continue
        # Cheap: store what we have from the card now
        store_card_observation(follower.username, card)

        # Optional: full-profile fetch only if we don't have it
        if not already_have_full_profile(card.username):
            candidate = profile_adapter.fetch(card.username)  # +1 load
            profile_loads_this_run += 1
            store_person(candidate)
            store_edge(card.username, follower.username, 'follows')  # directional: candidate → my-follower

    queue.mark(follower, 'done')
```

`LOAD_BUDGET` defaults to 100 per run. That's the ban-risk knob, not "qualifying added."

### 6.3 Filtering (post-hoc, runs after the crawl)

```
python -m ig filter \
  --min-followers 200 \
  --min-mutuals 4 \
  --geo bangalore \             # matches bio OR inferred
  --name-fuzzy-threshold 85 \
  --limit 30
```

Output is a ranked list of qualifying candidates. Re-runnable any time with different params. Since `geo-propagate` runs before filtering, inferred-BLR people are automatically included; rerun `geo-propagate` later and the same query surfaces new inferred matches without any new IG traffic.

### 6.4 Cost per qualifying candidate

Visiting 1 seed-follower yields ~10 suggestion cards. ~70% are new → ~7 candidate-profile loads. So ~8 profile loads per seed-follower → at 100/run budget, ~12 seed-followers per run, ~85 candidates added to graph per run. Of those, ~30-40% pass the post-hoc filter → 25-35 qualifying per run, which lines up with your 30-target. ~3 hours wall clock at our pacing.

## 7. Storage schema (SQLite)

```sql
CREATE TABLE people (
  username        TEXT PRIMARY KEY,
  full_name       TEXT,
  bio             TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count     INTEGER,
  external_url    TEXT,
  is_private      INTEGER,
  is_verified     INTEGER,
  city            TEXT,                -- normalized: 'bangalore', 'mumbai', etc.
  city_source     TEXT,                -- 'bio' | 'inferred' | 'manual' | NULL
  city_confidence REAL,                -- 0..1; 1.0 for bio, computed for inferred
  first_seen_at   TEXT NOT NULL,
  last_refreshed_at TEXT
);

CREATE TABLE edges (
  src      TEXT NOT NULL,              -- username
  dst      TEXT NOT NULL,
  kind     TEXT NOT NULL,              -- 'follows' | 'suggested' | 'mutual_with_me'
  weight   INTEGER,                    -- for 'suggested': mutual count
  seen_at  TEXT NOT NULL,
  PRIMARY KEY (src, dst, kind)
);
CREATE INDEX idx_edges_dst ON edges(dst);

CREATE TABLE crawl_queue (
  username     TEXT PRIMARY KEY,
  depth        INTEGER NOT NULL,       -- 0 = my follower, 1 = their suggestion
  status       TEXT NOT NULL,          -- 'pending' | 'in_flight' | 'done' | 'skipped' | 'error'
  enqueued_at  TEXT NOT NULL,
  attempted_at TEXT,
  error        TEXT
);

CREATE TABLE runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT NOT NULL,
  ended_at        TEXT,
  status          TEXT,                -- 'running' | 'completed' | 'blocked' | 'killed'
  qualifying_added INTEGER DEFAULT 0,
  profile_loads   INTEGER DEFAULT 0,
  block_reason    TEXT
);

CREATE TABLE run_events (
  run_id    INTEGER NOT NULL,
  ts        TEXT NOT NULL,
  kind      TEXT NOT NULL,             -- 'load' | 'skip' | 'add' | 'pause' | 'block'
  payload   TEXT
);

CREATE TABLE name_match_list (
  pattern     TEXT PRIMARY KEY,        -- raw entry from user
  notes       TEXT
);

CREATE TABLE name_matches (
  username    TEXT NOT NULL,
  pattern     TEXT NOT NULL,
  score       REAL NOT NULL,           -- rapidfuzz token_set_ratio
  PRIMARY KEY (username, pattern)
);
```

Atomicity: every page load wraps in a transaction (`BEGIN; insert person; insert edges; update queue; COMMIT`) so a crash can't leave half-written state.

## 8. Geo inference

### Pass 1 — bio scan (confirmed, confidence=1.0)
Regex against bio + full_name + external_url:
- `\b(bangalore|bengaluru|blr|namma\s*bengaluru)\b`
- 560xxx pincodes
- Known BLR neighborhoods: `\b(koramangala|indiranagar|whitefield|hsr|jayanagar|jp\s*nagar|hebbal|electronic\s*city|sarjapur|marathahalli|btm)\b`
- Emoji + city: `📍\s*(blr|bangalore)`

Anti-patterns to exclude (false positives): "ex-bangalore", "from bangalore, now in X". Run a second regex pass to strip these before matching.

### Pass 2 — neighborhood propagation (inferred)
For each unlabeled person P, compute over P's known graph neighbors (people we've seen P follow or be followed by, plus people who appear in P's suggestion panel):
- `n_labeled` = neighbors with `city_source IN ('bio', 'manual')`
- `n_blr` = subset labeled `bangalore`

If `n_labeled >= 10` AND `n_blr / n_labeled >= 0.6`, mark `city='bangalore', city_source='inferred', city_confidence=n_blr/n_labeled`.

This is run as a batch job (nightly or after each crawl session), not inline. It's monotonic — as bio labels accrete, more people qualify for inferred labels. Reruns are cheap (single SQL aggregation).

**Important**: candidates can match the Bangalore filter via bio OR inferred geo. But for ban-budget purposes, we don't let inferred-only nudge us to visit more profiles in the same run — inferred labels apply across runs.

## 9. Fuzzy name matcher

- User maintains a plain text file `names.txt`, one entry per line ("Aryan Pahwani", "Ananya G.", etc.).
- Loaded into `name_match_list` table on startup.
- After each `people` insert, compute `rapidfuzz.fuzz.token_set_ratio(full_name, pattern)` against every pattern.
- Store any pair with score ≥ 80 in `name_matches`.
- A CLI `query` command lists people with name matches above threshold, sorted by score.

Name matching is **decorative** for the candidate filter — i.e., a high-score name match boosts a person to "show me even if they fail mutuals/geo." Concretely: a person passes the filter if `mutuals>=4 OR city=bangalore OR has_name_match>=85`.

## 10. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Checkpoint redirect | URL contains `/challenge/` | Hard stop, alert operator, mark run blocked |
| 429 on XHR | response listener | Backoff 30m, retry once |
| Suggestion selector drift | 3 consecutive profiles return 0 cards from a non-empty panel | Stop run, log DOM snapshot, manual selector update |
| IG returns 0 followers in list | follower count > 0 but scrape empty | Likely DOM change; snapshot + halt |
| Chrome disconnects | CDP connection error | Wait 60s, try reconnect once, else halt |
| SQLite write contention | rare for single-writer; SQLite WAL mode + retry | n/a (only one writer) |
| Power loss mid-page | queue row stuck in `in_flight` | On startup, sweep `in_flight` older than 5 min back to `pending` |

## 11. Module layout

```
src/
  harness/
    chrome.py            # CDP attach, reconnect logic
    human.py             # click/scroll/type with jitter
    pacing.py            # delays, macro breaks, diurnal gate
    detect.py            # checkpoint/429/throttle checks
  adapters/
    followers_list.py
    profile.py
    suggestions.py
  traversal/
    queue.py             # SQLite-backed queue ops
    engine.py            # the loop in §6.2
    filters.py           # mutuals/followers/geo/name pipeline
  geo/
    bio_scan.py
    propagate.py
  matching/
    fuzzy.py
  storage/
    schema.sql
    db.py                # connection, transactions
  cli/
    crawl.py             # `python -m ig crawl --max 30`
    query.py             # `python -m ig query --city blr --min-mutuals 4`
    geo_pass.py          # `python -m ig geo-propagate`
    names.py             # `python -m ig names load names.txt`
tests/
  adapters/              # frozen-HTML fixtures
  traversal/             # filter logic, queue ops
  geo/                   # regex, propagation math
data/
  graph.db               # SQLite
  chrome-profile/        # CDP user-data-dir
  snapshots/             # DOM snapshots on selector failures
```

## 12. Phased build plan

**Phase 0 — harness only (1-2 days).** Stand up CDP-attach + human input + pacing + detect. Visit 10 profiles by hand from a queue, log everything. Goal: prove no checkpoint, validate pacing curve. Zero crawling logic.

**Phase 1 — adapters + storage (2-3 days).** Build the three page adapters with snapshot tests. Build SQLite schema. CLI command that takes a list of usernames and dumps profile + suggestions to DB. Still no traversal.

**Phase 2 — traversal MVP (2 days).** The §6.2 loop, queue management, global cap of 30. First real end-to-end runs. Hand-validate the 30 candidates.

**Phase 3 — geo + fuzzy + query CLI (2 days).** Bio scan, propagation job, fuzzy matcher, query CLI to surface candidates.

**Phase 4 — hardening (ongoing).** Selector-drift snapshots, recovery tests, pacing tuning from `run_events`.

Total to a useful single-user tool: **~2 weeks** at deliberate pace. Product UX (intro routing, matching algo, multi-tenant auth) is a separate scope after the graph is trusted.

## 13. Resolved decisions

1. **Selector drift.** Halt + alert + dashboard. No self-healing LLM layer. Dashboard CLI shows last-block reason, queue health, recent zero-card events. (See §15.)
2. **Inferred geo.** Filtering is post-hoc; geo-propagation runs before each filter pass, so inferred-BLR people qualify automatically without coupling to the crawl loop. Re-filterable any time.
3. **Exclusion set.** Use the user's main account's *followers* list (not "following"). Rationale: this is a follower-growth tool — surface people who don't already follow main, so following them has upside. Sourced via IG's official "Download Your Information" export, not by scraping (see §16 — scraping main's followers from the burner is the worst possible link signal).
4. **Refresh.** None. One fetch per person, ever. `last_refreshed_at` stays in schema as informational only.
5. **Names privacy.** Plaintext for POC. Revisit at productization.

## 15. Dashboard

`python -m ig dashboard` prints (and optionally watches with `--follow`) a rolling health view, all sourced from `run_events`:

```
=== ig-scrape dashboard ===  (last refresh: 2026-06-09 14:22 IST)

LAST RUN: #47    started 12:08    ended 14:11    status: completed
  profile loads:        87 / 100
  new people added:      52
  zero-card panels:       2 / 26  (7.7%)   [baseline 5%, ok]
  avg profile load p50:  1.4s     p95: 3.1s   [baseline 1.5 / 3.2, ok]
  challenge redirects:    0
  429 responses:          0
  paused for breaks:      3 (total 28m)

GRAPH:
  total people:        612
  with bio-geo:        184   (30%)
  with inferred-geo:    91
  BLR candidates:      127   (qualifying under default filter: 38)

QUEUE:
  pending:    104
  in_flight:    0
  done:        47
  skipped:     12
  error:        1   [@some_user — selector miss, snapshot saved]

ALERTS:
  (none)
```

A red alert appears for: any challenge in last 24h, any 429 in last 24h, zero-card rate >15% over last 10 panels, profile-load p95 >2× baseline, or queue stuck on a single `in_flight` row >5 min.

## 16. Main account protection (hard constraint)

Goal: the burner getting blocked must have **near-zero** effect on your main account. The risks aren't behavioral — main never runs the crawler — they're **linkage signals** that let IG associate the two accounts. If they associate them, any burner enforcement can spill over to main.

### Linkage signals we eliminate

| Signal | Mitigation |
|---|---|
| Same device fingerprint | Burner runs in a dedicated Chrome `--user-data-dir`. Main never logs in there. Different installed-extensions list, different bookmarks, different history. |
| Same login session in same browser profile | Never log into main from the crawler Chrome instance. Use your normal everyday Chrome (or any other browser) for main. |
| Burner viewing main's followers list / profile repeatedly | **Critical**: do NOT scrape main's followers from the burner. Use IG's official **"Download Your Information"** export (Settings → Account Center → Your information and permissions → Download your information → select "Followers and following" → JSON). User triggers manually every few weeks. Zero scraping → zero link signal. |
| Burner following main, main following burner | Don't. They stay strangers on IG. |
| Burner interacting with main's posts / DMs | Don't. |
| Same phone number, same email recovery | Register burner with a different email + phone (Google Voice / e-SIM secondary works fine). |
| Same contact graph (uploaded contacts cross-referencing) | Disable "Sync Contacts" on burner. Don't add main's number to burner's phone contacts. |

### Linkage signals we *can't* eliminate but mitigate

| Signal | Mitigation | Residual risk |
|---|---|---|
| Same residential IP | Both accounts using home WiFi is a fingerprint match. Mitigation: don't use main and burner in the same hour. Stagger activity. | Low-medium. Many real households share IPs. |
| Burner-then-main browsing pattern | Don't switch from burner Chrome → main Chrome → burner repeatedly. | Low. |
| Same timezone, language, ISP | Unavoidable. Matches "household" pattern which IG sees constantly. | Low. |

### Operational rules

- Burner Chrome profile lives at `~/.ig-scrape-chrome-profile`. **Only the burner ever uses it.**
- Main account browsing uses your default Chrome profile or any other browser. Treat the burner profile as a one-purpose tool you don't touch outside crawl sessions.
- `main_followers.json` (from the official export) is the only artifact main contributes to the system. The crawler reads it as a flat exclusion list.
- If you decide to refresh the exclusion list, you re-export from main in your normal browser — never from the burner profile — and drop the JSON into the project. `python -m ig main-followers import main_followers.json` ingests it.
- Phone/email recovery options on burner: different from main, both. If IG asks burner for SMS verification, the code goes to a number main doesn't share.

### Worst case

If despite all this, the burner gets permanently disabled and IG does associate it with main:
- Most likely outcome: nothing visible to main (linkage is internal, not public).
- Less likely: main gets a "we noticed unusual activity" prompt asking to confirm identity. Cosmetic.
- Very unlikely: main gets restricted. Pre-cursor signals (zero-card rate, latency drift on burner) would have warned us long before this.

We monitor burner-side signals exactly so we can stop before any of that triggers. The dashboard's "alerts" section is the daily check-in surface.

## 17. What this doc does not cover

- The intro-routing product UX. Out of scope for MVP.
- Mobile-app scraping (private API, much higher detection risk). Not pursued.
- Adversarial robustness if IG actively targets this pattern. Mitigation is pacing + burner; if IG escalates, we revisit.
