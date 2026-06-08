import { cn } from '../../lib/cn'

interface BarProps {
  value: number
  max: number
  tone?: 'phosphor' | 'amber' | 'scarlet' | 'bone'
  height?: number
  showTicks?: boolean
  className?: string
}

const toneClass = {
  phosphor: 'bg-phosphor',
  amber: 'bg-amber',
  scarlet: 'bg-scarlet',
  bone: 'bg-bone-muted',
}

export function Bar({ value, max, tone = 'phosphor', height = 6, showTicks = true, className }: BarProps) {
  const pct = Math.max(0, Math.min(1, value / max))
  const dangerTone: typeof tone =
    pct > 0.92 ? 'scarlet' : pct > 0.75 ? 'amber' : tone
  return (
    <div className={cn('relative w-full overflow-hidden', className)} style={{ height }}>
      <div className="absolute inset-0 bg-hairline" />
      <div
        className={cn('absolute inset-y-0 left-0 transition-[width] duration-500', toneClass[dangerTone])}
        style={{ width: `${pct * 100}%` }}
      />
      {showTicks && (
        <div className="absolute inset-0 flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-ink/40 last:border-r-0" />
          ))}
        </div>
      )}
    </div>
  )
}
