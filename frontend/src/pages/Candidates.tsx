import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ExternalLink, ChevronDown, ChevronRight, Sliders, MapPin, Users, Search } from 'lucide-react'
import { api } from '../lib/api'
import type { Candidate, CandidateFilters, CandidateStatus } from '../types'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { Button } from '../components/ui/Button'
import { Slider } from '../components/ui/Slider'
import { Select } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'
import { fmtCount, fmtRelative } from '../lib/format'
import { cn } from '../lib/cn'

const DEFAULTS: Required<Pick<CandidateFilters,
  'min_followers' | 'min_mutuals' | 'city' | 'include_inferred' | 'inferred_confidence_min' | 'name_fuzzy_min' | 'status' | 'sort'
>> = {
  min_followers: 200,
  min_mutuals: 4,
  city: 'bangalore',
  include_inferred: true,
  inferred_confidence_min: 0.6,
  name_fuzzy_min: 85,
  status: 'all',
  sort: 'mutuals_desc',
}

export function Candidates() {
  const [filters, setFilters] = useState<CandidateFilters>(DEFAULTS)
  const [rows, setRows] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.candidates(filters).then((r) => { setRows(r.results); setTotal(r.total) })
  }, [filters])

  const visible = useMemo(() => {
    if (!query) return rows
    const q = query.toLowerCase()
    return rows.filter(r =>
      r.username.includes(q) ||
      (r.full_name?.toLowerCase().includes(q)) ||
      (r.bio?.toLowerCase().includes(q)))
  }, [rows, query])

  const updateStatus = async (u: string, s: CandidateStatus) => {
    setRows(prev => prev.map(r => r.username === u ? { ...r, status: s } : r))
    await api.updateCandidate(u, s)
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Filter sidebar */}
      <aside className="col-span-12 lg:col-span-3 xl:col-span-3 space-y-4">
        <Card label="Filter" trailing={<Sliders size={11} className="text-bone-faint" />}>
          <Slider
            label="Min followers"
            value={filters.min_followers ?? DEFAULTS.min_followers}
            min={100}
            max={10000}
            step={100}
            onChange={(v) => setFilters(f => ({ ...f, min_followers: v }))}
            format={(v) => fmtCount(v)}
          />
          <div className="mt-5">
            <Slider
              label="Min mutuals"
              value={filters.min_mutuals ?? DEFAULTS.min_mutuals}
              min={0}
              max={30}
              onChange={(v) => setFilters(f => ({ ...f, min_mutuals: v }))}
              format={(v) => v.toString()}
            />
          </div>
          <hr className="my-5 border-hairline" />
          <Select
            label="City"
            value={(filters.city as string) ?? 'bangalore'}
            options={[
              { value: 'any', label: 'any city' },
              { value: 'bangalore', label: 'bangalore' },
              { value: 'mumbai', label: 'mumbai' },
              { value: 'delhi', label: 'delhi' },
            ]}
            onChange={(v) => setFilters(f => ({ ...f, city: v }))}
          />
          <div className="mt-4">
            <Toggle
              checked={!!filters.include_inferred}
              onChange={(v) => setFilters(f => ({ ...f, include_inferred: v }))}
              label="include inferred-geo"
            />
          </div>
          {filters.include_inferred && (
            <div className="mt-4">
              <Slider
                label="Inferred confidence ≥"
                value={filters.inferred_confidence_min ?? 0.6}
                min={0.5}
                max={0.95}
                step={0.05}
                onChange={(v) => setFilters(f => ({ ...f, inferred_confidence_min: v }))}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          )}
          <hr className="my-5 border-hairline" />
          <Slider
            label="Name fuzzy ≥"
            value={filters.name_fuzzy_min ?? DEFAULTS.name_fuzzy_min}
            min={50}
            max={100}
            onChange={(v) => setFilters(f => ({ ...f, name_fuzzy_min: v }))}
            format={(v) => v.toString()}
          />
          <hr className="my-5 border-hairline" />
          <Select
            label="Status"
            value={filters.status ?? 'all'}
            options={[
              { value: 'all', label: 'all' },
              { value: 'unreviewed', label: 'unreviewed' },
              { value: 'saved', label: 'saved' },
              { value: 'followed', label: 'followed' },
              { value: 'dismissed', label: 'dismissed' },
            ]}
            onChange={(v) => setFilters(f => ({ ...f, status: v as CandidateStatus }))}
          />
          <div className="mt-4">
            <Select
              label="Sort"
              value={filters.sort ?? 'mutuals_desc'}
              options={[
                { value: 'mutuals_desc', label: 'mutuals · desc' },
                { value: 'followers_desc', label: 'followers · desc' },
                { value: 'name_match_desc', label: 'name-match · desc' },
                { value: 'recency_desc', label: 'recency · desc' },
              ]}
              onChange={(v) => setFilters(f => ({ ...f, sort: v as CandidateFilters['sort'] }))}
            />
          </div>
          <Button variant="ghost" className="w-full mt-5" onClick={() => setFilters(DEFAULTS)}>
            reset to defaults
          </Button>
        </Card>
      </aside>

      {/* Table */}
      <section className="col-span-12 lg:col-span-9 xl:col-span-9 space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="section-label">Candidates</div>
            <div className="flex items-baseline gap-3">
              <span className="numeric-xl text-[32px] text-bone leading-none">{visible.length}</span>
              <span className="font-mono text-[12px] text-bone-faint">
                of {total} matched · {rows.length - visible.length > 0 ? `${rows.length - visible.length} hidden by search · ` : ''}
                filter active
              </span>
            </div>
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bone-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search username, name, bio"
              className="h-9 w-64 bg-ink-elevated border border-hairline pl-7 pr-3 font-mono text-[12px] text-bone placeholder:text-bone-ghost focus:outline-none focus:border-indigo-soft"
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="grid grid-cols-[40px_1.6fr_1fr_72px_72px_120px_120px_44px] gap-3 px-3 py-2 border-b border-hairline section-label">
            <span />
            <span>person</span>
            <span>bio</span>
            <span className="text-right">followers</span>
            <span className="text-right">mutuals</span>
            <span>city</span>
            <span>status</span>
            <span />
          </div>
          {visible.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-hairline">
              {visible.map((c, i) => (
                <CandidateRow
                  key={c.username}
                  c={c}
                  index={i}
                  expanded={expanded.has(c.username)}
                  onToggle={() => {
                    setExpanded(prev => {
                      const next = new Set(prev)
                      next.has(c.username) ? next.delete(c.username) : next.add(c.username)
                      return next
                    })
                  }}
                  onStatus={updateStatus}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function CandidateRow({
  c, index, expanded, onToggle, onStatus,
}: {
  c: Candidate
  index: number
  expanded: boolean
  onToggle: () => void
  onStatus: (u: string, s: CandidateStatus) => void
}) {
  const initials = (c.full_name ?? c.username)
    .split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('')
  const maxNameScore = c.name_matches.length ? Math.max(...c.name_matches.map(m => m.score)) : 0
  const statusTone =
    c.status === 'saved' ? 'phosphor' :
    c.status === 'followed' ? 'indigo' :
    c.status === 'dismissed' ? 'bone' :
    'amber'

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.015 }}
      className={cn('grid grid-cols-[40px_1.6fr_1fr_72px_72px_120px_120px_44px] gap-3 px-3 py-2.5 items-center hover:bg-ink-elevated/40 group', c.status === 'dismissed' && 'opacity-50')}
    >
      <div className="flex items-center justify-center size-9 border border-hairline-bright bg-ink-elevated font-mono text-[11px] text-bone tracking-wider">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={`https://instagram.com/${c.username}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[13px] text-bone hover:text-phosphor inline-flex items-center gap-1.5 group/u truncate"
          >
            @{c.username}
            <ExternalLink size={10} className="text-bone-ghost group-hover/u:text-phosphor" />
          </a>
          {c.is_verified && <Chip tone="indigo" size="sm">verified</Chip>}
        </div>
        <div className="text-[12px] text-bone-muted truncate mt-0.5">{c.full_name}</div>
        {c.name_matches.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {c.name_matches.map(m => (
              <Chip key={m.pattern} tone="indigo" variant="outline">
                {m.pattern} · {m.score}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className="text-[12px] text-bone-muted truncate font-sans" title={c.bio ?? ''}>
        {c.bio ?? <span className="text-bone-ghost italic">no bio</span>}
      </div>
      <div className="text-right font-mono text-[13px] text-bone tabular-nums">
        {fmtCount(c.followers_count)}
      </div>
      <div className="text-right">
        <MutualsBar mutuals={c.mutuals_with_me} />
      </div>
      <CityChip city={c.city} source={c.city_source} confidence={c.city_confidence} />
      <StatusDropdown value={c.status} onChange={(s) => onStatus(c.username, s)} tone={statusTone} />
      <button
        onClick={onToggle}
        className="size-7 inline-flex items-center justify-center text-bone-faint hover:text-bone hover:bg-ink-elevated transition-colors"
        aria-label={expanded ? 'collapse' : 'expand'}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {expanded && (
        <div className="col-span-8 mt-3 pt-3 border-t border-hairline">
          <div className="grid grid-cols-3 gap-6 text-[12px]">
            <Detail label="Suggested by">
              <ul className="space-y-1">
                {c.suggested_by.map(s => (
                  <li key={s.username} className="font-mono text-bone-muted">
                    @{s.username}{' '}
                    <span className="text-bone-ghost">{s.full_name}</span>
                  </li>
                ))}
              </ul>
            </Detail>
            <Detail label="Following / posts">
              <div className="font-mono text-bone">
                follows <span className="tabular-nums">{fmtCount(c.following_count)}</span>
              </div>
              {c.external_url && (
                <div className="font-mono text-bone-muted mt-1">↗ {c.external_url}</div>
              )}
            </Detail>
            <Detail label="Discovered">
              <div className="font-mono text-bone-muted">{fmtRelative(c.first_seen_at)}</div>
              {maxNameScore > 0 && (
                <div className="font-mono text-bone-muted mt-1">name match: <span className="text-indigo-soft">{maxNameScore}</span></div>
              )}
            </Detail>
          </div>
        </div>
      )}
    </motion.li>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="section-label mb-1">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function MutualsBar({ mutuals, max = 10 }: { mutuals: number; max?: number }) {
  const pct = Math.min(1, mutuals / max)
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className="font-mono text-[13px] text-bone tabular-nums">{mutuals}</span>
      <div className="w-12 h-0.5 bg-hairline">
        <div className="h-full bg-phosphor" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

function CityChip({ city, source, confidence }: { city: string | null; source: 'bio' | 'inferred' | 'manual' | null; confidence: number | null }) {
  if (!city) return <span className="text-bone-ghost font-mono text-[11px]">—</span>
  const isInferred = source === 'inferred'
  return (
    <div className="inline-flex items-center gap-1.5">
      <Chip tone={city === 'bangalore' ? 'phosphor' : 'bone'} variant={isInferred ? 'outline' : 'filled'} icon={<MapPin size={9} />}>
        {city.toUpperCase()}
      </Chip>
      {isInferred && confidence != null && (
        <span className="font-mono text-[10px] text-bone-faint tabular-nums">{Math.round(confidence * 100)}%</span>
      )}
    </div>
  )
}

function StatusDropdown({ value, onChange, tone }: { value: CandidateStatus; onChange: (v: CandidateStatus) => void; tone: 'phosphor' | 'amber' | 'indigo' | 'bone' }) {
  const colorClass =
    tone === 'phosphor' ? 'text-phosphor border-phosphor/40' :
    tone === 'amber' ? 'text-amber border-amber/40' :
    tone === 'indigo' ? 'text-indigo-soft border-indigo-soft/40' :
    'text-bone-muted border-hairline-bright'
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CandidateStatus)}
        className={cn(
          'appearance-none w-full h-7 pl-2 pr-6 border bg-transparent font-mono text-[11px] uppercase tracking-wider focus:outline-none',
          colorClass,
        )}
      >
        <option value="unreviewed" className="bg-ink text-bone">unreviewed</option>
        <option value="saved" className="bg-ink text-bone">saved</option>
        <option value="followed" className="bg-ink text-bone">followed</option>
        <option value="dismissed" className="bg-ink text-bone">dismissed</option>
      </select>
      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Users size={20} className="text-bone-ghost" />
      <div className="font-mono text-[12px] text-bone-faint uppercase tracking-widest">
        no candidates match these filters
      </div>
      <div className="text-[12px] text-bone-muted">
        run a crawl from the dashboard, or relax filters.
      </div>
    </div>
  )
}
