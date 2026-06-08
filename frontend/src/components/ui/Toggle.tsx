import { cn } from '../../lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  className?: string
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('inline-flex items-center gap-2 group', className)}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          'relative inline-flex h-4 w-7 items-center transition-colors',
          checked ? 'bg-phosphor/30 border border-phosphor/60' : 'bg-ink-elevated border border-hairline-bright',
        )}
      >
        <span
          className={cn(
            'inline-block size-2.5 transition-transform',
            checked ? 'translate-x-3.5 bg-phosphor' : 'translate-x-0.5 bg-bone-faint',
          )}
          style={checked ? { boxShadow: '0 0 6px var(--color-phosphor-glow)' } : undefined}
        />
      </span>
      {label && (
        <span className={cn('section-label group-hover:text-bone-muted transition-colors', checked && 'text-bone')}>
          {label}
        </span>
      )}
    </button>
  )
}
