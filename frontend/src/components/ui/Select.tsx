import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

interface SelectProps<T extends string> {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}

export function Select<T extends string>({ label, value, options, onChange, className }: SelectProps<T>) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="section-label">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={cn(
            'appearance-none w-full h-9 px-3 pr-8',
            'bg-ink-elevated border border-hairline',
            'font-mono text-[12px] text-bone',
            'hover:border-hairline-bright focus:outline-none focus:border-indigo-soft',
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-ink text-bone">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bone-faint pointer-events-none"
        />
      </div>
    </label>
  )
}
