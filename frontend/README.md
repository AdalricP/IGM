# IGM Frontend — graph console

Local operator UI for the Instagram graph crawler. Single-user POC. Reads from
a local Python backend on `:8765` (built separately by codex against
`API_CONTRACT.md`).

## Quick start

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8765` (the backend), so
nothing extra is needed once the backend is up.

While the backend doesn't exist yet, the UI runs on mock data. Toggle the three
prebuilt scenarios in the top-right corner: **nominal · running · alerting**.
The toggle persists to localStorage and reloads the page.

When the backend is reachable, flip `USE_MOCKS = false` in
`src/lib/api.ts` and the same calls hit real endpoints.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS v4** (theme tokens in `src/index.css` under `@theme`)
- **Motion** for restrained reveals
- **react-force-graph-2d** for the network view
- **lucide-react** for icons
- **JetBrains Mono** (Google Fonts) + **Cabinet Grotesk** (Fontshare CDN)

No state management library — local `useState` and the global mock module are
enough at this size.

## Layout

```
src/
  main.tsx               entry
  App.tsx                router
  index.css              @theme tokens, base typography, scanlines/grain
  types.ts               canonical TS types — backend mirrors these
  lib/
    api.ts               single swap point: mocks → real fetch
    mock.ts              three-scenario fixture data
    format.ts            humanize numbers, durations, relative times
    cn.ts                clsx wrapper
  components/
    layout/              AppShell, TopBar, Clock
    ui/                  Card, Chip, StatusDot, Sparkline, Bar, Button,
                         Modal, Slider, Select, Toggle
  pages/
    Dashboard.tsx        the operator's main view
    Candidates.tsx       filter + table review surface
    Graph.tsx            2D force-directed network
    Names.tsx            names.txt editor with live match preview
API_CONTRACT.md          types + endpoint sketch for the backend
```

## Aesthetic notes (in case someone touches this later)

The visual language is **"sodium-vapor ops console"** — a dim, dense, terminal-
inspired interface meant to feel like a control room at 2am. Conventions:

- Phosphor mint (`#7fffc9`) = nominal / alive.
- Amber (`#f2a341`) = watch this.
- Scarlet (`#ff4d4d`) = stop.
- Indigo soft (`#8b8dee`) = links / focus / non-status accents.
- Bone (`#e7e4dc`) on ink (`#0a0a0b`) = body chrome.
- Hairlines only — no shadows.
- All numerals are tabular and monospace.
- Status conveys via **both** color AND shape (filled vs outline chip) so a
  colorblind operator can still tell things apart.

Do not:
- Add purple gradients.
- Swap fonts for Inter or system-ui — JetBrains Mono and Cabinet Grotesk are
  load-bearing for the feel.
- Replace hairlines with shadows.
- Round corners more than ~4px — most things are sharp.

## Keyboard

- `⌘1` dashboard · `⌘2` candidates · `⌘3` graph · `⌘4` names
- `⌘.` kill running run (when running)
- `⌘↵` start new crawl run (in start modal)
- `esc` close modals

## Backend integration

When codex finishes the backend, the only change here is:

```ts
// src/lib/api.ts
const USE_MOCKS = false
```

Vite is already proxying `/api/*` to `:8765` in `vite.config.ts`.

For production-ish deploy, you can build with `npm run build` and have the
FastAPI backend serve the `dist/` directory directly (single port, no CORS).
