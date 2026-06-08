import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Clock } from './Clock'
import { StatusDot } from '../ui/StatusDot'
import { cn } from '../../lib/cn'
import { getScenario, setScenario, type MockScenario } from '../../lib/mock'

const NAV = [
  { to: '/', label: 'dashboard', kbd: '⌘1' },
  { to: '/candidates', label: 'candidates', kbd: '⌘2' },
  { to: '/graph', label: 'graph', kbd: '⌘3' },
  { to: '/names', label: 'names', kbd: '⌘4' },
]

export function TopBar() {
  const nav = useNavigate()
  const [scenario, setScn] = useState<MockScenario>(getScenario())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const map: Record<string, string> = { '1': '/', '2': '/candidates', '3': '/graph', '4': '/names' }
      if (map[e.key]) { e.preventDefault(); nav(map[e.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav])

  return (
    <header className="h-12 flex items-center gap-6 px-5 border-b border-hairline bg-ink/80 backdrop-blur sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="size-2 bg-phosphor glow-phosphor" />
        <span className="font-mono font-bold tracking-wider text-[14px] text-bone">
          IGM<span className="text-phosphor">.</span>
          <span className="cursor-blink align-baseline" />
        </span>
        <span className="text-[10px] font-mono text-bone-ghost ml-2 hidden md:inline">
          graph console / v0.1 / single-user
        </span>
      </div>

      <nav className="flex items-center gap-1 ml-2">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cn(
                'h-8 px-3 inline-flex items-center gap-2 border border-transparent font-mono text-[12px] uppercase tracking-wider',
                isActive
                  ? 'text-bone border-hairline bg-ink-raised'
                  : 'text-bone-faint hover:text-bone',
              )
            }
          >
            <span>{n.label}</span>
            <span className="text-[10px] text-bone-ghost">{n.kbd}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <ScenarioToggle value={scenario} onChange={(s) => { setScn(s); setScenario(s); window.location.reload() }} />
        <Uptime />
        <Clock />
        <div className="flex items-center gap-2 pl-4 border-l border-hairline">
          <StatusDot tone="phosphor" />
          <span className="font-mono text-[11px] text-bone-muted tracking-wider uppercase">online</span>
        </div>
      </div>
    </header>
  )
}

function Uptime() {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = now - start
  const h = Math.floor(ms / 3600_000)
  const m = Math.floor((ms % 3600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return (
    <span className="font-mono text-[11px] text-bone-ghost tabular-nums hidden lg:inline">
      uptime {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
    </span>
  )
}

function ScenarioToggle({ value, onChange }: { value: MockScenario; onChange: (v: MockScenario) => void }) {
  const opts: MockScenario[] = ['nominal', 'running', 'alerting']
  return (
    <div className="flex items-center gap-px border border-hairline">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            'h-7 px-2 font-mono text-[10px] uppercase tracking-wider',
            value === o
              ? o === 'alerting' ? 'bg-scarlet/15 text-scarlet' :
                o === 'running' ? 'bg-phosphor/15 text-phosphor' :
                'bg-bone-ghost/40 text-bone'
              : 'text-bone-faint hover:text-bone-muted',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
