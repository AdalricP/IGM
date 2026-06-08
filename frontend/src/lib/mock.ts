import type {
  Candidate,
  CandidatesResponse,
  DashboardPayload,
  GraphResponse,
  NamesPayload,
  RunEvent,
} from '../types'

// Toggle this to preview different operator states without backend.
// 'nominal' = idle, last run completed cleanly
// 'running' = mid-run, healthy
// 'alerting' = something is going wrong, two alerts active
export type MockScenario = 'nominal' | 'running' | 'alerting'

const LS_KEY = 'igm.mock.scenario'

export function getScenario(): MockScenario {
  if (typeof window === 'undefined') return 'running'
  const v = window.localStorage.getItem(LS_KEY) as MockScenario | null
  return v ?? 'running'
}

export function setScenario(s: MockScenario) {
  window.localStorage.setItem(LS_KEY, s)
}

const now = (offsetMin = 0) =>
  new Date(Date.now() + offsetMin * 60_000).toISOString()

const past = (offsetMin: number) =>
  new Date(Date.now() - offsetMin * 60_000).toISOString()

const baseEvents: RunEvent[] = [
  { ts: past(0.4), kind: 'add', payload: '@maya.rk — followers=4.2k, mutuals=6, bio:blr' },
  { ts: past(0.9), kind: 'load', payload: '@vir_pillai — profile + suggestions panel (10 cards)' },
  { ts: past(1.3), kind: 'skip', payload: '@ad_eats — followers<200 (124)' },
  { ts: past(1.8), kind: 'load', payload: '@maya.rk' },
  { ts: past(2.5), kind: 'add', payload: '@sn.aushtosh — followers=1.8k, mutuals=4, inferred:blr 71%' },
  { ts: past(3.1), kind: 'macro_break', payload: 'sleeping 8m21s (after 21 profiles)' },
  { ts: past(11.2), kind: 'load', payload: '@vir_pillai' },
  { ts: past(11.9), kind: 'skip', payload: '@anubhav.lifts — private profile' },
  { ts: past(12.5), kind: 'add', payload: '@kashi.read — followers=312, mutuals=5, bio:bengaluru' },
  { ts: past(13.0), kind: 'load', payload: '@aravind.t' },
  { ts: past(13.6), kind: 'add', payload: '@apurva.does.stuff — followers=4.7k, mutuals=4, bio:hsr' },
  { ts: past(14.2), kind: 'queue', payload: 'enqueued 9 cards from @rohit.kumar suggestions' },
  { ts: past(14.8), kind: 'load', payload: '@rohit.kumar' },
  { ts: past(15.4), kind: 'load', payload: '@neha.codes' },
  { ts: past(16.1), kind: 'skip', payload: '@vyom_____ — already in main\'s followers' },
  { ts: past(16.8), kind: 'add', payload: '@deepak.s — followers=890, mutuals=4, bio:koramangala' },
]

const alertingEvents: RunEvent[] = [
  { ts: past(0.2), kind: 'block', payload: 'zero-card panels: 4/8 this run, threshold breached' },
  { ts: past(0.3), kind: 'pause', payload: 'halting run — soft throttle inferred' },
  { ts: past(2.1), kind: 'load', payload: '@rashmi.k — panel returned 0 cards' },
  { ts: past(2.8), kind: 'load', payload: '@adi.nair — panel returned 0 cards' },
  { ts: past(3.4), kind: 'load', payload: '@yash.tech — panel returned 0 cards' },
  { ts: past(4.0), kind: '429', payload: 'XHR /api/v1/users/web_profile_info — backing off 30m' },
  { ts: past(8.3), kind: 'load', payload: '@aarav.designs — panel returned 4 cards (ok)' },
  ...baseEvents.slice(5),
]

function generateLatencySeries(baseline: number, drift = 0, samples = 40): number[] {
  // tiny seeded jitter (no Math.random in mock for stability across rerenders is fine here)
  const out: number[] = []
  for (let i = 0; i < samples; i++) {
    const t = i / samples
    const wobble = Math.sin(i * 0.7) * 60 + Math.cos(i * 0.31) * 35
    out.push(Math.max(400, baseline + wobble + drift * t * baseline))
  }
  return out
}

const nominalDashboard: DashboardPayload = {
  server_time: now(),
  uptime_ms: 1000 * 60 * 60 * 4 + 1000 * 23,
  current_or_last_run: {
    id: 46,
    started_at: past(184),
    ended_at: past(61),
    status: 'completed',
    profile_loads: 87,
    load_budget: 100,
    qualifying_added: 28,
    new_people_added: 52,
    zero_card_rate: 0.077,
    zero_card_baseline: 0.05,
    latency_p50_ms: 1400,
    latency_p95_ms: 3100,
    latency_p50_baseline_ms: 1500,
    latency_p95_baseline_ms: 3200,
    latency_sparkline: generateLatencySeries(1400),
    challenges_24h: 0,
    rate_limits_24h: 0,
    macro_breaks: 3,
    macro_break_ms_total: 1000 * 60 * 28,
    block_reason: null,
  },
  queue: {
    pending: 104,
    in_flight: 0,
    done: 47,
    skipped: 12,
    error: 1,
    stuck_username: null,
  },
  graph: {
    total_people: 612,
    with_bio_geo: 184,
    with_inferred_geo: 91,
    blr_candidates: 127,
    qualifying_default: 38,
  },
  alerts: [],
  recent_events: baseEvents,
}

const runningDashboard: DashboardPayload = {
  ...nominalDashboard,
  server_time: now(),
  current_or_last_run: {
    ...nominalDashboard.current_or_last_run,
    id: 47,
    started_at: past(38),
    ended_at: null,
    status: 'running',
    profile_loads: 43,
    qualifying_added: 11,
    new_people_added: 19,
    zero_card_rate: 0.062,
    latency_p50_ms: 1380,
    latency_p95_ms: 3050,
    macro_breaks: 1,
    macro_break_ms_total: 1000 * 60 * 9,
    latency_sparkline: generateLatencySeries(1380),
  },
  queue: {
    pending: 76,
    in_flight: 1,
    done: 30,
    skipped: 8,
    error: 0,
    stuck_username: null,
  },
  alerts: [],
}

const alertingDashboard: DashboardPayload = {
  ...runningDashboard,
  server_time: now(),
  current_or_last_run: {
    ...runningDashboard.current_or_last_run,
    id: 48,
    started_at: past(12),
    ended_at: null,
    status: 'paused',
    profile_loads: 19,
    qualifying_added: 2,
    new_people_added: 3,
    zero_card_rate: 0.42,
    latency_p50_ms: 2980,
    latency_p95_ms: 7400,
    challenges_24h: 0,
    rate_limits_24h: 1,
    latency_sparkline: generateLatencySeries(1400, 0.9),
    block_reason: 'zero-card rate breached (42% > 15%); auto-paused for inspection',
  },
  queue: {
    pending: 92,
    in_flight: 1,
    done: 14,
    skipped: 5,
    error: 0,
    stuck_username: '@yash.tech',
  },
  alerts: [
    {
      id: 'a1',
      severity: 'critical',
      title: 'Zero-card rate breach',
      detail:
        '4 of last 8 suggestion panels returned 0 cards. Baseline is 5%. Likely soft throttle — review event log before resuming.',
      raised_at: past(0.5),
    },
    {
      id: 'a2',
      severity: 'warning',
      title: 'Latency p95 elevated',
      detail: 'p95 7.4s, baseline 3.2s. Network or IG-side slowdown — monitor.',
      raised_at: past(1.8),
    },
  ],
  recent_events: alertingEvents,
}

// ─── Candidates ─────────────────────────────────────────────────────────────

const candidates: Candidate[] = [
  {
    username: 'maya.rk',
    full_name: 'Maya Ramakrishnan',
    bio: 'product @ stealth · ex-zerodha · runs in cubbon · bengaluru → goa monthly',
    followers_count: 4200,
    following_count: 612,
    external_url: 'mayark.substack.com',
    is_verified: false,
    is_private: false,
    mutuals_with_me: 6,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [],
    status: 'unreviewed',
    first_seen_at: past(0.4),
    suggested_by: [
      { username: 'vir_pillai', full_name: 'Vir Pillai' },
      { username: 'aravind.t', full_name: 'Aravind T.' },
    ],
  },
  {
    username: 'kashi.read',
    full_name: 'Kashish Verma',
    bio: 'books ⊂ life. bengaluru. occasionally writes about software.',
    followers_count: 312,
    following_count: 280,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 5,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [{ pattern: 'Kashish V', score: 92 }],
    status: 'unreviewed',
    first_seen_at: past(12.5),
    suggested_by: [{ username: 'rohit.kumar', full_name: 'Rohit Kumar' }],
  },
  {
    username: 'sn.aushtosh',
    full_name: 'Aushtosh S. Naik',
    bio: 'devtools, climbing, slow coffee',
    followers_count: 1820,
    following_count: 410,
    external_url: 'aushtosh.dev',
    is_verified: false,
    is_private: false,
    mutuals_with_me: 4,
    city: 'bangalore',
    city_source: 'inferred',
    city_confidence: 0.71,
    name_matches: [],
    status: 'saved',
    first_seen_at: past(2.5),
    suggested_by: [{ username: 'maya.rk', full_name: 'Maya Ramakrishnan' }],
  },
  {
    username: 'apurva.does.stuff',
    full_name: 'Apurva Joshi',
    bio: 'designer · hsr · weekend ceramics @apurvas.ceramics',
    followers_count: 4700,
    following_count: 720,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 4,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [{ pattern: 'Apurva J', score: 88 }],
    status: 'unreviewed',
    first_seen_at: past(13.6),
    suggested_by: [
      { username: 'maya.rk', full_name: 'Maya Ramakrishnan' },
      { username: 'kashi.read', full_name: 'Kashish Verma' },
    ],
  },
  {
    username: 'deepak.s',
    full_name: 'Deepak Sundararajan',
    bio: 'koramangala. building something small. dm to chat',
    followers_count: 890,
    following_count: 230,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 4,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [],
    status: 'unreviewed',
    first_seen_at: past(16.8),
    suggested_by: [{ username: 'rohit.kumar', full_name: 'Rohit Kumar' }],
  },
  {
    username: 'neha.codes',
    full_name: 'Neha Iyer',
    bio: 'eng @ razorpay. blr. ig is mostly food.',
    followers_count: 2100,
    following_count: 380,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 7,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [{ pattern: 'Neha I', score: 91 }],
    status: 'unreviewed',
    first_seen_at: past(15.4),
    suggested_by: [
      { username: 'aravind.t', full_name: 'Aravind T.' },
      { username: 'vir_pillai', full_name: 'Vir Pillai' },
      { username: 'maya.rk', full_name: 'Maya Ramakrishnan' },
    ],
  },
  {
    username: 'aravind.t',
    full_name: 'Aravind Thirumalai',
    bio: 'infra · ex-stripe · cubbon park weekend',
    followers_count: 6200,
    following_count: 520,
    external_url: 'thirumalai.dev',
    is_verified: false,
    is_private: false,
    mutuals_with_me: 9,
    city: 'bangalore',
    city_source: 'inferred',
    city_confidence: 0.84,
    name_matches: [],
    status: 'followed',
    first_seen_at: past(13.0),
    suggested_by: [{ username: 'vir_pillai', full_name: 'Vir Pillai' }],
  },
  {
    username: 'rohit.kumar',
    full_name: 'Rohit Kumar',
    bio: 'climbing · trail running · btm 1',
    followers_count: 540,
    following_count: 410,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 5,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [],
    status: 'dismissed',
    first_seen_at: past(14.8),
    suggested_by: [{ username: 'aravind.t', full_name: 'Aravind T.' }],
  },
  {
    username: 'vir_pillai',
    full_name: 'Vir Pillai',
    bio: 'pm @ unknown company. namma bengaluru. cricket > everything.',
    followers_count: 3400,
    following_count: 690,
    external_url: null,
    is_verified: false,
    is_private: false,
    mutuals_with_me: 8,
    city: 'bangalore',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [],
    status: 'unreviewed',
    first_seen_at: past(0.9),
    suggested_by: [{ username: 'aravind.t', full_name: 'Aravind T.' }],
  },
  {
    username: 'ad_writes',
    full_name: 'Aditya Ghosh',
    bio: 'editor at large. mumbai. occasionally in blr.',
    followers_count: 11200,
    following_count: 880,
    external_url: 'adityaghosh.com',
    is_verified: false,
    is_private: false,
    mutuals_with_me: 3,
    city: 'mumbai',
    city_source: 'bio',
    city_confidence: 1,
    name_matches: [{ pattern: 'Aditya G', score: 89 }],
    status: 'unreviewed',
    first_seen_at: past(22.0),
    suggested_by: [{ username: 'neha.codes', full_name: 'Neha Iyer' }],
  },
]

const namesPayload: NamesPayload = {
  patterns: [
    'Maya R',
    'Aushtosh',
    'Kashish V',
    'Apurva J',
    'Neha I',
    'Aditya G',
    'Sneha',
    'Aryan',
  ],
  match_count: 14,
}

// ─── Graph data — a small, illustrative network ─────────────────────────────

const graphData: GraphResponse = {
  nodes: [
    { id: 'me', full_name: 'me', followers: 1100, city: 'bangalore', city_source: 'manual', is_seed: true },
    { id: 'vir_pillai', full_name: 'Vir Pillai', followers: 3400, city: 'bangalore', city_source: 'bio', is_seed: true },
    { id: 'aravind.t', full_name: 'Aravind T.', followers: 6200, city: 'bangalore', city_source: 'inferred', is_seed: true },
    { id: 'maya.rk', full_name: 'Maya R.', followers: 4200, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'rohit.kumar', full_name: 'Rohit Kumar', followers: 540, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'kashi.read', full_name: 'Kashish V.', followers: 312, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'sn.aushtosh', full_name: 'Aushtosh', followers: 1820, city: 'bangalore', city_source: 'inferred', is_seed: false },
    { id: 'apurva.does.stuff', full_name: 'Apurva J.', followers: 4700, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'deepak.s', full_name: 'Deepak S.', followers: 890, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'neha.codes', full_name: 'Neha I.', followers: 2100, city: 'bangalore', city_source: 'bio', is_seed: false },
    { id: 'ad_writes', full_name: 'Aditya G.', followers: 11200, city: 'mumbai', city_source: 'bio', is_seed: false },
    { id: 'yash.tech', full_name: 'Yash', followers: 720, city: null, city_source: null, is_seed: false },
    { id: 'rashmi.k', full_name: 'Rashmi K.', followers: 1340, city: null, city_source: null, is_seed: false },
    { id: 'adi.nair', full_name: 'Adi N.', followers: 5100, city: 'bangalore', city_source: 'inferred', is_seed: false },
  ],
  links: [
    { source: 'vir_pillai', target: 'me', kind: 'follows', weight: null },
    { source: 'aravind.t', target: 'me', kind: 'follows', weight: null },
    { source: 'maya.rk', target: 'vir_pillai', kind: 'suggested', weight: 6 },
    { source: 'maya.rk', target: 'aravind.t', kind: 'suggested', weight: 5 },
    { source: 'rohit.kumar', target: 'aravind.t', kind: 'suggested', weight: 5 },
    { source: 'kashi.read', target: 'rohit.kumar', kind: 'suggested', weight: 4 },
    { source: 'sn.aushtosh', target: 'maya.rk', kind: 'suggested', weight: 4 },
    { source: 'apurva.does.stuff', target: 'maya.rk', kind: 'suggested', weight: 4 },
    { source: 'apurva.does.stuff', target: 'kashi.read', kind: 'suggested', weight: 4 },
    { source: 'deepak.s', target: 'rohit.kumar', kind: 'suggested', weight: 4 },
    { source: 'neha.codes', target: 'aravind.t', kind: 'suggested', weight: 7 },
    { source: 'neha.codes', target: 'vir_pillai', kind: 'suggested', weight: 7 },
    { source: 'neha.codes', target: 'maya.rk', kind: 'suggested', weight: 7 },
    { source: 'ad_writes', target: 'neha.codes', kind: 'suggested', weight: 3 },
    { source: 'yash.tech', target: 'vir_pillai', kind: 'suggested', weight: 2 },
    { source: 'rashmi.k', target: 'aravind.t', kind: 'suggested', weight: 2 },
    { source: 'adi.nair', target: 'maya.rk', kind: 'suggested', weight: 4 },
    { source: 'adi.nair', target: 'aravind.t', kind: 'suggested', weight: 4 },
  ],
}

// ─── Public mock accessors (api.ts swaps these for real fetch) ──────────────

export function mockDashboard(scenario: MockScenario = getScenario()): DashboardPayload {
  switch (scenario) {
    case 'nominal': return { ...nominalDashboard, server_time: now() }
    case 'running': return { ...runningDashboard, server_time: now() }
    case 'alerting': return { ...alertingDashboard, server_time: now() }
  }
}

export function mockCandidates(): CandidatesResponse {
  return { results: candidates, total: candidates.length, next_cursor: null }
}

export function mockGraph(): GraphResponse {
  return graphData
}

export function mockNames(): NamesPayload {
  return namesPayload
}
