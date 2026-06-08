// Canonical TypeScript types for the IGM backend ↔ frontend contract.
// Backend (built separately by codex) must mirror these shapes.
// See API_CONTRACT.md for endpoint documentation.

export type RunStatus = 'idle' | 'running' | 'completed' | 'blocked' | 'killed' | 'paused'

export type EventKind =
  | 'load'
  | 'skip'
  | 'add'
  | 'pause'
  | 'block'
  | 'challenge'
  | '429'
  | 'macro_break'
  | 'queue'
  | 'error'

export type CandidateStatus = 'unreviewed' | 'saved' | 'dismissed' | 'followed'

export type CitySource = 'bio' | 'inferred' | 'manual' | null

export type AlertSeverity = 'warning' | 'critical'

export interface RunSummary {
  id: number
  started_at: string // ISO
  ended_at: string | null // ISO
  status: RunStatus
  profile_loads: number
  load_budget: number
  qualifying_added: number
  new_people_added: number
  zero_card_rate: number // 0-1, current run
  zero_card_baseline: number // 0-1, rolling baseline
  latency_p50_ms: number
  latency_p95_ms: number
  latency_p50_baseline_ms: number
  latency_p95_baseline_ms: number
  latency_sparkline: number[] // recent p95 samples for sparkline
  challenges_24h: number
  rate_limits_24h: number
  macro_breaks: number
  macro_break_ms_total: number
  block_reason: string | null
}

export interface QueueSummary {
  pending: number
  in_flight: number
  done: number
  skipped: number
  error: number
  stuck_username: string | null // populated if in_flight row > 5 min
}

export interface GraphTotals {
  total_people: number
  with_bio_geo: number
  with_inferred_geo: number
  blr_candidates: number
  qualifying_default: number
}

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  raised_at: string
}

export interface RunEvent {
  ts: string
  kind: EventKind
  payload: string
}

export interface DashboardPayload {
  server_time: string
  uptime_ms: number
  current_or_last_run: RunSummary
  queue: QueueSummary
  graph: GraphTotals
  alerts: Alert[]
  recent_events: RunEvent[] // up to 50, newest first
}

export interface NameMatch {
  pattern: string
  score: number
}

export interface SuggestedBy {
  username: string
  full_name: string | null
}

export interface Candidate {
  username: string
  full_name: string | null
  bio: string | null
  followers_count: number
  following_count: number
  external_url: string | null
  is_verified: boolean
  is_private: boolean
  mutuals_with_me: number
  city: string | null
  city_source: CitySource
  city_confidence: number | null // 0..1
  name_matches: NameMatch[]
  status: CandidateStatus
  first_seen_at: string
  suggested_by: SuggestedBy[] // typically 1-3
}

export interface CandidateFilters {
  min_followers?: number
  min_mutuals?: number
  city?: string | 'any'
  include_inferred?: boolean
  inferred_confidence_min?: number
  name_fuzzy_min?: number
  status?: CandidateStatus | 'all'
  sort?: 'mutuals_desc' | 'followers_desc' | 'name_match_desc' | 'recency_desc'
  limit?: number
  cursor?: string
}

export interface CandidatesResponse {
  results: Candidate[]
  total: number
  next_cursor: string | null
}

export interface GraphNode {
  id: string
  full_name: string | null
  followers: number
  city: string | null
  city_source: CitySource
  is_seed: boolean
}

export interface GraphLink {
  source: string
  target: string
  kind: 'follows' | 'suggested'
  weight: number | null
}

export interface GraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface NamesPayload {
  patterns: string[]
  match_count: number // total people in DB matching at least one pattern
}

export interface StartRunRequest {
  load_budget: number
}

export interface StartRunResponse {
  run_id: number
  status: RunStatus
}
