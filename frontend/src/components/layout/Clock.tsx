import { useEffect, useState } from 'react'
import { fmtClock } from '../../lib/format'

export function Clock() {
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-[12px] text-bone-muted tabular-nums">
      {fmtClock(now)} <span className="text-bone-ghost">IST</span>
    </span>
  )
}
