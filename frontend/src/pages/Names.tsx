import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, RotateCcw, Hash } from 'lucide-react'
import { api } from '../lib/api'
import { mockCandidates } from '../lib/mock'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { Button } from '../components/ui/Button'

// Lightweight fuzzy match (token-set-ratio approximation) for live preview only.
// Real matching happens server-side via rapidfuzz.
function tokenSetRatio(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean))
  const A = tok(a), B = tok(b)
  if (A.size === 0 || B.size === 0) return 0
  const inter = [...A].filter(x => B.has(x))
  const interLen = inter.join(' ').length
  const aLen = [...A].join(' ').length
  const bLen = [...B].join(' ').length
  if (interLen === 0) return 0
  return Math.round((2 * interLen / (aLen + bLen)) * 100)
}

export function Names() {
  const [text, setText] = useState('')
  const [initial, setInitial] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.getNames().then(p => {
      const t = p.patterns.join('\n')
      setText(t); setInitial(t)
    })
  }, [])

  const patterns = useMemo(() =>
    text.split('\n').map(s => s.trim()).filter(Boolean),
    [text]
  )

  const matches = useMemo(() => {
    const rows = mockCandidates().results
    const result: { pattern: string; hits: { username: string; full_name: string | null; score: number }[] }[] = []
    for (const p of patterns) {
      const hits = rows.map(r => ({
        username: r.username,
        full_name: r.full_name,
        score: tokenSetRatio(p, r.full_name ?? r.username),
      }))
        .filter(h => h.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
      result.push({ pattern: p, hits })
    }
    return result
  }, [patterns])

  const dirty = text !== initial
  const totalHits = matches.reduce((s, m) => s + m.hits.length, 0)

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 lg:col-span-7" label="names.txt" trailing={
        <div className="flex items-center gap-2">
          <Chip tone="bone" variant="outline" icon={<Hash size={9} />}>{patterns.length} patterns</Chip>
          {dirty && <Chip tone="amber">unsaved</Chip>}
        </div>
      }>
        <p className="text-[12px] text-bone-muted mb-3 font-sans">
          One name per line. Fuzzy-matched against the full names of crawled people using
          token_set_ratio. Match results in the candidate filter when the maximum score on
          a person crosses your threshold (default 85).
        </p>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={20}
          className="w-full bg-ink-elevated border border-hairline focus:border-indigo-soft focus:outline-none p-3 font-mono text-[13px] text-bone leading-relaxed resize-y"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="text-[10.5px] font-mono text-bone-faint">
            saved to <span className="text-bone">names.txt</span> on the server when you click save.
            {saved != null && <span className="ml-2 text-phosphor">✓ saved {saved} patterns</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setText(initial)} disabled={!dirty}>
              <RotateCcw size={11} /> revert
            </Button>
            <Button
              variant="phosphor"
              kbd="⌘S"
              onClick={async () => {
                const p = await api.putNames(patterns)
                setInitial(text)
                setSaved(p.patterns.length)
                setTimeout(() => setSaved(null), 2500)
              }}
              disabled={!dirty}
            >
              <Save size={11} /> save
            </Button>
          </div>
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-5" label="Live match preview" trailing={
        <Chip tone={totalHits ? 'phosphor' : 'bone'} variant={totalHits ? 'filled' : 'outline'}>
          {totalHits} hits
        </Chip>
      }>
        <p className="text-[11.5px] text-bone-faint mb-3 font-mono">
          approx. preview — server uses rapidfuzz for authoritative scoring.
        </p>
        <div className="max-h-[480px] overflow-y-auto -mx-2 divide-y divide-hairline">
          {matches.map((m, i) => (
            <div key={`${m.pattern}-${i}`} className="px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] text-bone">{m.pattern}</span>
                <span className="font-mono text-[10.5px] text-bone-faint">{m.hits.length} matches</span>
              </div>
              {m.hits.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {m.hits.map(h => (
                    <li key={h.username} className="flex items-center gap-2 text-[11.5px]">
                      <span className="font-mono text-bone-muted">@{h.username}</span>
                      <span className="text-bone-ghost">·</span>
                      <span className="text-bone-muted flex-1 truncate">{h.full_name}</span>
                      <span className={
                        'font-mono tabular-nums ' +
                        (h.score >= 85 ? 'text-phosphor' : h.score >= 70 ? 'text-amber' : 'text-bone-faint')
                      }>
                        {h.score}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-[11px] font-mono text-bone-ghost italic">no matches</div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
