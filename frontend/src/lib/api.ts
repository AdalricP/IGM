// Single point of swap between mock data (during frontend dev) and the real
// backend codex builds against API_CONTRACT.md. Set USE_MOCKS=false (or strip
// the mock branch entirely) once the backend is reachable on :8765.

import type {
  Candidate,
  CandidatesResponse,
  CandidateFilters,
  DashboardPayload,
  GraphResponse,
  NamesPayload,
  StartRunResponse,
  StartRunRequest,
  CandidateStatus,
} from '../types'
import {
  mockCandidates,
  mockDashboard,
  mockGraph,
  mockNames,
} from './mock'

const USE_MOCKS = true

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  async dashboard(): Promise<DashboardPayload> {
    if (USE_MOCKS) return Promise.resolve(mockDashboard())
    return http('/api/dashboard')
  },

  async candidates(filters: CandidateFilters = {}): Promise<CandidatesResponse> {
    if (USE_MOCKS) {
      const all = mockCandidates()
      const f = applyFiltersLocally(all.results, filters)
      return { results: f, total: f.length, next_cursor: null }
    }
    const q = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v))
    })
    return http(`/api/candidates?${q.toString()}`)
  },

  async updateCandidate(username: string, status: CandidateStatus): Promise<void> {
    if (USE_MOCKS) return Promise.resolve()
    await http(`/api/candidates/${encodeURIComponent(username)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  async startRun(req: StartRunRequest): Promise<StartRunResponse> {
    if (USE_MOCKS)
      return { run_id: 99, status: 'running' as const }
    return http('/api/runs/start', { method: 'POST', body: JSON.stringify(req) })
  },

  async stopRun(id: number): Promise<void> {
    if (USE_MOCKS) return Promise.resolve()
    await http(`/api/runs/${id}/stop`, { method: 'POST' })
  },

  async graph(limit = 500): Promise<GraphResponse> {
    if (USE_MOCKS) return Promise.resolve(mockGraph())
    return http(`/api/graph?limit=${limit}`)
  },

  async getNames(): Promise<NamesPayload> {
    if (USE_MOCKS) return Promise.resolve(mockNames())
    return http('/api/names')
  },

  async putNames(patterns: string[]): Promise<NamesPayload> {
    if (USE_MOCKS) return Promise.resolve({ ...mockNames(), patterns })
    return http('/api/names', { method: 'PUT', body: JSON.stringify({ patterns }) })
  },
}

function applyFiltersLocally(
  rows: Candidate[],
  f: CandidateFilters,
): Candidate[] {
  let out = rows.slice()
  if (f.min_followers != null) out = out.filter(c => c.followers_count >= f.min_followers!)
  if (f.min_mutuals != null) out = out.filter(c => c.mutuals_with_me >= f.min_mutuals!)
  if (f.city && f.city !== 'any') {
    out = out.filter(c => {
      if (c.city !== f.city) return false
      if (c.city_source === 'inferred' && !f.include_inferred) return false
      if (
        c.city_source === 'inferred' &&
        f.inferred_confidence_min != null &&
        (c.city_confidence ?? 0) < f.inferred_confidence_min
      ) return false
      return true
    })
  }
  if (f.name_fuzzy_min != null) {
    out = out.filter(c =>
      c.name_matches.length === 0 ||
      c.name_matches.some(m => m.score >= f.name_fuzzy_min!),
    )
  }
  if (f.status && f.status !== 'all') out = out.filter(c => c.status === f.status)
  if (f.sort) {
    const cmp: Record<NonNullable<CandidateFilters['sort']>, (a: Candidate, b: Candidate) => number> = {
      mutuals_desc: (a, b) => b.mutuals_with_me - a.mutuals_with_me,
      followers_desc: (a, b) => b.followers_count - a.followers_count,
      name_match_desc: (a, b) =>
        (Math.max(0, ...b.name_matches.map(m => m.score))) -
        (Math.max(0, ...a.name_matches.map(m => m.score))),
      recency_desc: (a, b) => b.first_seen_at.localeCompare(a.first_seen_at),
    }
    out.sort(cmp[f.sort])
  }
  return out
}
