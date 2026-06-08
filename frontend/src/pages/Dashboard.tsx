import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight,
  Pause, Play, Square, Wifi, ZapOff, Activity, Database, ListChecks,
} from 'lucide-react'
import { api } from '../lib/api'
import type { DashboardPayload, RunEvent, RunStatus } from '../types'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { StatusDot } from '../components/ui/StatusDot'
import { Sparkline } from '../components/ui/Sparkline'
import { Bar } from '../components/ui/Bar'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Slider } from '../components/ui/Slider'
import { fmtCount, fmtMs, fmtPct, fmtRelative, fmtDuration } from '../lib/format'
import { cn } from '../lib/cn'

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [budget, setBudget] = useState(100)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = () => api.dashboard().then((d) => mounted && setData(d))
    load()
    const t = setInterval(load, 5000)
    return () => { mounted = false; clearInterval(t) }
  }, [])

  if (!data) return <BootingState />

  const run = data.current_or_last_run
  const isRunning = run.status === 'running'
  const isPaused = run.status === 'paused'
  const isAlerting = data.alerts.length > 0

  return (
    <div className="space-y-4">
      {/* Alerts banner */}
      <AnimatePresence>
        {isAlerting && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex items-stretch gap-4 border border-scarlet/40 bg-scarlet/10">
              <div className="w-1 bg-scarlet glow-scarlet" />
              <div className="flex-1 py-3 pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-scarlet" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-scarlet">
                    {data.alerts.filter(a => a.severity === 'critical').length} critical ·{' '}
                    {data.alerts.filter(a => a.severity === 'warning').length} warning
                  </span>
                </div>
                <div className="space-y-1.5">
                  {data.alerts.map(a => (
                    <div key={a.id} className="flex items-start gap-3 text-[12.5px]">
                      <span className={cn(
                        'mt-1 font-mono text-[10px] uppercase tracking-wider',
                        a.severity === 'critical' ? 'text-scarlet' : 'text-amber',
                      )}>
                        {a.severity === 'critical' ? 'STOP' : 'WATCH'}
                      </span>
                      <span className="text-bone">
                        <strong className="font-medium">{a.title}.</strong>{' '}
                        <span className="text-bone-muted">{a.detail}</span>
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-bone-ghost">
                        {fmtRelative(a.raised_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero strip: run id + status + actions */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="flex items-end gap-6">
          <div>
            <div className="section-label">Active run</div>
            <div className="flex items-baseline gap-3">
              <span className="numeric-xl text-[44px] leading-none text-bone tracking-tight">
                #{run.id.toString().padStart(3, '0')}
              </span>
              <StatusPill status={run.status} />
            </div>
            <div className="text-[12px] font-mono text-bone-muted mt-1">
              {run.ended_at ? (
                <>
                  ran {fmtRelative(run.started_at)} → {fmtRelative(run.ended_at)} · duration{' '}
                  <span className="text-bone">{fmtDuration(new Date(run.ended_at).getTime() - new Date(run.started_at).getTime())}</span>
                </>
              ) : (
                <>
                  started {fmtRelative(run.started_at)} · elapsed{' '}
                  <span className="text-bone">{fmtDuration(Date.now() - new Date(run.started_at).getTime())}</span>
                </>
              )}
              {run.block_reason && (
                <div className="text-amber mt-0.5">⚠ {run.block_reason}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(isRunning || isPaused) ? (
            <>
              <Button
                variant="ghost"
                onClick={async () => { setBusy(true); await api.stopRun(run.id); setBusy(false) }}
                disabled={busy}
              >
                <Pause size={12} /> {isPaused ? 'paused' : 'pause'}
              </Button>
              <Button
                variant="danger"
                onClick={async () => { setBusy(true); await api.stopRun(run.id); setBusy(false) }}
                disabled={busy}
                kbd="⌘."
              >
                <Square size={12} /> kill run
              </Button>
            </>
          ) : (
            <Button variant="phosphor" onClick={() => setStartOpen(true)} kbd="⌘↵">
              <Play size={12} /> start crawl run
            </Button>
          )}
        </div>
      </div>

      {/* Row 1: pacing | queue | aux */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-6" label="Pacing · profile loads">
          <div className="flex items-end justify-between">
            <div className="numeric-xl text-[36px] leading-none">
              <span className="text-bone">{run.profile_loads}</span>
              <span className="text-bone-faint text-[20px]"> / {run.load_budget}</span>
            </div>
            <div className="text-right">
              <div className="section-label">qualifying added</div>
              <div className="numeric-xl text-[20px] text-phosphor text-glow-phosphor">
                {run.qualifying_added}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Bar value={run.profile_loads} max={run.load_budget} />
            <div className="flex justify-between mt-1.5 text-[10.5px] font-mono text-bone-faint">
              <span>{Math.round((run.profile_loads / run.load_budget) * 100)}% consumed</span>
              <span>{run.load_budget - run.profile_loads} remaining</span>
            </div>
          </div>
          <hr className="my-3 border-hairline" />
          <dl className="grid grid-cols-3 gap-3 text-[11.5px]">
            <Stat compact label="new people" value={run.new_people_added.toString()} />
            <Stat compact label="macro breaks" value={`${run.macro_breaks} (${fmtMs(run.macro_break_ms_total)})`} />
            <Stat compact label="block reason" value={run.block_reason ? 'see banner' : '—'} tone={run.block_reason ? 'amber' : 'bone'} />
          </dl>
        </Card>

        <Card className="col-span-3" label="Queue">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <QueueStat label="pending" value={data.queue.pending} tone="bone" />
            <QueueStat label="in_flight" value={data.queue.in_flight} tone={data.queue.in_flight ? 'phosphor' : 'bone'} pulse={!!data.queue.in_flight} />
            <QueueStat label="done" value={data.queue.done} tone="phosphor" />
            <QueueStat label="skipped" value={data.queue.skipped} tone="bone" />
            <QueueStat label="error" value={data.queue.error} tone={data.queue.error ? 'amber' : 'bone'} />
            <QueueStat label="total" value={data.queue.pending + data.queue.in_flight + data.queue.done + data.queue.skipped + data.queue.error} tone="bone" />
          </div>
          {data.queue.stuck_username && (
            <div className="mt-3 pt-3 border-t border-hairline flex items-center gap-2">
              <AlertTriangle size={11} className="text-amber" />
              <span className="text-[11px] font-mono text-amber">
                stuck: <span className="text-bone">@{data.queue.stuck_username}</span> {'>'} 5min
              </span>
            </div>
          )}
        </Card>

        <Card className="col-span-3" label="Connection">
          <div className="flex items-center gap-2">
            <Wifi size={12} className="text-phosphor" />
            <span className="font-mono text-[12px] text-bone">CDP → :9222</span>
          </div>
          <div className="mt-1 text-[10.5px] font-mono text-bone-faint">
            chromium attached · 1 tab · cookies present
          </div>
          <hr className="my-3 border-hairline" />
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-phosphor" />
            <span className="font-mono text-[12px] text-bone">main isolation</span>
          </div>
          <div className="mt-1 text-[10.5px] font-mono text-bone-faint">
            burner profile only · exclusion list from export
          </div>
        </Card>
      </div>

      {/* Row 2: health signals */}
      <div>
        <div className="section-label mb-2">Health signals · ban-risk surface</div>
        <div className="grid grid-cols-12 gap-4">
          <HealthCard
            label="Zero-card panels"
            value={fmtPct(run.zero_card_rate)}
            baseline={`baseline ${fmtPct(run.zero_card_baseline)}`}
            delta={run.zero_card_rate - run.zero_card_baseline}
            sparkline={[5, 4, 6, 5, 4, 5, 6, 5, 4, 8, 5, 6, run.zero_card_rate * 100]}
            unit="%"
            thresholdPct={0.15}
          />
          <HealthCard
            label="Profile load p95"
            value={fmtMs(run.latency_p95_ms)}
            baseline={`baseline ${fmtMs(run.latency_p95_baseline_ms)}`}
            delta={(run.latency_p95_ms - run.latency_p95_baseline_ms) / run.latency_p95_baseline_ms}
            sparkline={run.latency_sparkline}
          />
          <HealthCard
            label="Challenge redirects"
            value={run.challenges_24h.toString()}
            baseline="24h"
            sparkline={[0, 0, 0, 0, 0, 0, 0, 0, 0, run.challenges_24h]}
            critical={run.challenges_24h > 0}
            invertGood
          />
          <HealthCard
            label="Rate-limit hits (429)"
            value={run.rate_limits_24h.toString()}
            baseline="24h"
            sparkline={[0, 0, 0, 0, 0, 0, 0, run.rate_limits_24h]}
            warning={run.rate_limits_24h > 0}
            invertGood
          />
        </div>
      </div>

      {/* Row 3: graph totals + event log */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-4" label="Graph state" trailing={<Chip tone="bone" variant="outline">{data.graph.total_people} total</Chip>}>
          <GraphStatLine
            label="confirmed bio-geo"
            current={data.graph.with_bio_geo}
            total={data.graph.total_people}
            tone="phosphor"
          />
          <GraphStatLine
            label="inferred-geo"
            current={data.graph.with_inferred_geo}
            total={data.graph.total_people}
            tone="indigo"
          />
          <hr className="my-3 border-hairline" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="section-label">BLR candidates</div>
              <div className="numeric-xl text-[24px] text-bone">{data.graph.blr_candidates}</div>
              <div className="text-[10.5px] font-mono text-bone-faint">confirmed + inferred</div>
            </div>
            <div>
              <div className="section-label">Qualifying (default)</div>
              <div className="numeric-xl text-[24px] text-phosphor text-glow-phosphor">{data.graph.qualifying_default}</div>
              <div className="text-[10.5px] font-mono text-bone-faint">≥200 followers · ≥4 mutuals</div>
            </div>
          </div>
        </Card>

        <Card
          className="col-span-8 overflow-hidden"
          label="Event log"
          bodyClassName="p-0"
          trailing={
            <span className="font-mono text-[10.5px] text-bone-faint">
              last {data.recent_events.length} · newest first
            </span>
          }
        >
          <EventLog events={data.recent_events} />
        </Card>
      </div>

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Start new crawl run">
        <p className="text-[12.5px] text-bone-muted mb-5">
          Load budget caps the number of Instagram profile loads this run. Each profile load is the
          dominant cost in ban-risk terms. Hard daily ceiling is 140; if you've used some today already,
          drop this accordingly. The crawler also enforces hourly caps and macro breaks regardless of this number.
        </p>
        <Slider
          label="Load budget"
          value={budget}
          min={20}
          max={140}
          step={10}
          onChange={setBudget}
          format={(v) => `${v} loads`}
        />
        <div className="flex items-center gap-2 mt-6 justify-end">
          <Button variant="ghost" onClick={() => setStartOpen(false)}>cancel</Button>
          <Button
            variant="phosphor"
            kbd="↵"
            onClick={async () => {
              setBusy(true)
              await api.startRun({ load_budget: budget })
              setStartOpen(false)
              setBusy(false)
              api.dashboard().then(setData)
            }}
            disabled={busy}
          >
            <Play size={12} /> start run
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function BootingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="size-2 bg-phosphor glow-phosphor" />
      <div className="font-mono text-[12px] text-bone-muted uppercase tracking-widest">
        booting console<span className="cursor-blink" />
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { tone: 'phosphor' | 'amber' | 'scarlet' | 'bone'; label: string; pulse?: boolean }> = {
    running: { tone: 'phosphor', label: 'running', pulse: true },
    completed: { tone: 'bone', label: 'completed' },
    paused: { tone: 'amber', label: 'paused', pulse: true },
    blocked: { tone: 'scarlet', label: 'blocked' },
    killed: { tone: 'bone', label: 'killed' },
    idle: { tone: 'bone', label: 'idle' },
  }
  const cfg = map[status]
  return (
    <Chip tone={cfg.tone} variant={cfg.tone === 'bone' ? 'outline' : 'filled'} icon={<StatusDot tone={cfg.tone} pulse={cfg.pulse} size={6} />}>
      {cfg.label}
    </Chip>
  )
}

function Stat({ label, value, tone = 'bone', compact = false }: { label: string; value: string; tone?: 'bone' | 'phosphor' | 'amber'; compact?: boolean }) {
  const toneClass = tone === 'phosphor' ? 'text-phosphor' : tone === 'amber' ? 'text-amber' : 'text-bone'
  return (
    <div>
      <div className="section-label mb-0.5">{label}</div>
      <div className={cn('font-mono tabular-nums', toneClass, compact ? 'text-[12px]' : 'text-[14px]')}>
        {value}
      </div>
    </div>
  )
}

function QueueStat({ label, value, tone = 'bone', pulse = false }: { label: string; value: number; tone?: 'bone' | 'phosphor' | 'amber'; pulse?: boolean }) {
  const toneClass = tone === 'phosphor' ? 'text-phosphor' : tone === 'amber' ? 'text-amber' : 'text-bone'
  return (
    <div className="flex items-center gap-2.5">
      <StatusDot tone={tone} pulse={pulse} size={6} />
      <div className="flex-1">
        <div className="section-label leading-none">{label}</div>
      </div>
      <div className={cn('font-mono tabular-nums text-[15px]', toneClass)}>
        {value.toString().padStart(3, '0')}
      </div>
    </div>
  )
}

function HealthCard({
  label, value, baseline, delta, sparkline, unit, thresholdPct, warning, critical, invertGood,
}: {
  label: string
  value: string
  baseline: string
  delta?: number
  sparkline: number[]
  unit?: string
  thresholdPct?: number
  warning?: boolean
  critical?: boolean
  invertGood?: boolean
}) {
  const tone: 'phosphor' | 'amber' | 'scarlet' =
    critical ? 'scarlet' :
    warning ? 'amber' :
    delta != null && delta > 0.3 ? 'amber' :
    'phosphor'

  const stroke =
    tone === 'scarlet' ? 'var(--color-scarlet)' :
    tone === 'amber' ? 'var(--color-amber)' :
    'var(--color-phosphor)'

  const fill =
    tone === 'scarlet' ? 'var(--color-scarlet)' :
    tone === 'amber' ? 'var(--color-amber)' :
    'var(--color-phosphor)'

  return (
    <Card span="sm" label={label}>
      <div className="flex items-end justify-between">
        <div className={cn('numeric-xl text-[28px] leading-none',
          tone === 'phosphor' && 'text-phosphor text-glow-phosphor',
          tone === 'amber' && 'text-amber text-glow-amber',
          tone === 'scarlet' && 'text-scarlet text-glow-scarlet',
        )}>
          {value}
        </div>
        {delta != null && (
          <DeltaPill delta={delta} invertGood={invertGood} unit={unit} />
        )}
      </div>
      <div className="text-[10.5px] font-mono text-bone-faint mt-1">{baseline}</div>
      <div className="mt-3">
        <Sparkline
          data={sparkline}
          width={220}
          height={32}
          stroke={stroke}
          fill={fill}
          threshold={thresholdPct ? thresholdPct * 100 : undefined}
        />
      </div>
    </Card>
  )
}

function DeltaPill({ delta, invertGood, unit }: { delta: number; invertGood?: boolean; unit?: string }) {
  const good = invertGood ? delta < 0 : delta < 0
  const direction = delta >= 0 ? 'up' : 'down'
  const Icon = direction === 'up' ? ArrowUpRight : ArrowDownRight
  const isFlat = Math.abs(delta) < 0.001
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-mono text-[10.5px] tabular-nums',
      isFlat ? 'text-bone-faint' :
      good ? 'text-phosphor' : 'text-amber',
    )}>
      <Icon size={10} />
      {isFlat ? '—' : `${Math.abs(delta * 100).toFixed(1)}${unit ?? '%'}`}
    </span>
  )
}

function GraphStatLine({ label, current, total, tone }: { label: string; current: number; total: number; tone: 'phosphor' | 'indigo' }) {
  const pct = total > 0 ? current / total : 0
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="section-label">{label}</span>
        <span className="font-mono text-[11.5px] text-bone tabular-nums">
          {current} <span className="text-bone-faint">/ {total}</span>
          <span className={cn('ml-2', tone === 'phosphor' ? 'text-phosphor' : 'text-indigo-soft')}>
            {fmtPct(pct, 0)}
          </span>
        </span>
      </div>
      <div className="h-1 bg-hairline w-full">
        <div
          className={cn('h-full transition-[width] duration-500', tone === 'phosphor' ? 'bg-phosphor' : 'bg-indigo-soft')}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

const KIND_TONE: Record<RunEvent['kind'], 'phosphor' | 'amber' | 'scarlet' | 'bone' | 'indigo'> = {
  add: 'phosphor',
  load: 'bone',
  skip: 'bone',
  pause: 'amber',
  block: 'scarlet',
  challenge: 'scarlet',
  '429': 'scarlet',
  macro_break: 'amber',
  queue: 'indigo',
  error: 'amber',
}

function EventLog({ events }: { events: RunEvent[] }) {
  return (
    <ul className="max-h-[480px] overflow-y-auto divide-y divide-hairline">
      {events.map((e, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-ink-elevated/50 group">
          <span className="font-mono text-[10.5px] text-bone-ghost tabular-nums w-14">
            {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}
          </span>
          <Chip tone={KIND_TONE[e.kind]} variant={e.kind === 'add' || e.kind === 'block' || e.kind === 'challenge' || e.kind === '429' ? 'filled' : 'outline'}>
            {e.kind}
          </Chip>
          <span className="text-[12px] text-bone flex-1 truncate font-mono">
            {e.payload}
          </span>
          <ChevronRight size={12} className="text-bone-ghost opacity-0 group-hover:opacity-100 transition-opacity" />
        </li>
      ))}
    </ul>
  )
}
