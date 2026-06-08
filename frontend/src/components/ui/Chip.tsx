import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

type Tone = 'phosphor' | 'amber' | 'scarlet' | 'indigo' | 'bone'
type Variant = 'filled' | 'outline'

interface ChipProps {
  tone?: Tone
  variant?: Variant
  size?: 'sm' | 'md'
  className?: string
  icon?: ReactNode
  children: ReactNode
}

const toneFilled: Record<Tone, string> = {
  phosphor: 'bg-phosphor/15 text-phosphor border-phosphor/30',
  amber: 'bg-amber/15 text-amber border-amber/30',
  scarlet: 'bg-scarlet/15 text-scarlet border-scarlet/30',
  indigo: 'bg-indigo-soft/15 text-indigo-soft border-indigo-soft/30',
  bone: 'bg-bone-ghost/40 text-bone border-hairline-bright',
}

const toneOutline: Record<Tone, string> = {
  phosphor: 'text-phosphor border-phosphor/45',
  amber: 'text-amber border-amber/45',
  scarlet: 'text-scarlet border-scarlet/45',
  indigo: 'text-indigo-soft border-indigo-soft/40',
  bone: 'text-bone-muted border-hairline-bright',
}

export function Chip({
  tone = 'bone',
  variant = 'filled',
  size = 'sm',
  className,
  icon,
  children,
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono uppercase tracking-wider border',
        size === 'sm' && 'h-[18px] px-1.5 text-[10px]',
        size === 'md' && 'h-6 px-2 text-[11px]',
        variant === 'filled' ? toneFilled[tone] : toneOutline[tone],
        className,
      )}
    >
      {icon && <span className="opacity-80">{icon}</span>}
      {children}
    </span>
  )
}
