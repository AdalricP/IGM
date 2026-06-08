// Human-friendly formatters. All return strings using tabular-nums-friendly chars.

export function fmtCount(n: number, decimals = 1): string {
  if (n < 1000) return n.toString()
  if (n < 1_000_000) {
    const v = n / 1000
    return v >= 100 ? `${Math.round(v)}k` : `${v.toFixed(decimals).replace(/\.0$/, '')}k`
  }
  return `${(n / 1_000_000).toFixed(decimals).replace(/\.0$/, '')}m`
}

export function fmtPct(p: number, decimals = 1): string {
  return `${(p * 100).toFixed(decimals).replace(/\.0$/, '')}%`
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2).replace(/\.?0+$/, '')}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s.toString().padStart(2, '0')}s`
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m${sec.toString().padStart(2, '0')}s`
  return `${m}m${sec.toString().padStart(2, '0')}s`
}

export function fmtRelative(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  const diff = Math.max(0, now - t)
  if (diff < 1000) return 'now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function fmtClock(iso: string): string {
  const d = new Date(iso)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
