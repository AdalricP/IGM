import { cn } from '../../lib/cn'

interface StatusDotProps {
  tone?: 'phosphor' | 'amber' | 'scarlet' | 'bone'
  pulse?: boolean
  size?: number
  className?: string
}

const toneClass = {
  phosphor: 'bg-phosphor text-phosphor',
  amber: 'bg-amber text-amber',
  scarlet: 'bg-scarlet text-scarlet',
  bone: 'bg-bone-faint text-bone-faint',
}

export function StatusDot({ tone = 'phosphor', pulse = false, size = 7, className }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block rounded-full', toneClass[tone], pulse && 'dot-pulse', className)}
      style={{ width: size, height: size }}
    />
  )
}
