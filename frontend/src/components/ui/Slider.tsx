import { cn } from '../../lib/cn'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  className?: string
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => v.toString(),
  className,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between">
        <span className="section-label">{label}</span>
        <span className="font-mono text-[12px] text-phosphor tabular-nums">{format(value)}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-hairline-bright" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px bg-phosphor"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 bg-ink border border-phosphor pointer-events-none"
          style={{ left: `${pct}%`, boxShadow: '0 0 8px var(--color-phosphor-glow)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-bone-ghost tabular-nums">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}
