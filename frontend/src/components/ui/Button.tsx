import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'ghost' | 'danger' | 'phosphor'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  kbd?: string // shows a keyboard hint on the right
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-bone text-ink border border-bone hover:bg-bone-muted hover:border-bone-muted active:bg-bone-faint',
  phosphor:
    'bg-phosphor/10 text-phosphor border border-phosphor/40 hover:bg-phosphor/20 hover:border-phosphor/60 hover:text-glow-phosphor active:bg-phosphor/30',
  ghost:
    'bg-transparent text-bone border border-hairline hover:border-hairline-bright hover:bg-ink-elevated',
  danger:
    'bg-scarlet/10 text-scarlet border border-scarlet/40 hover:bg-scarlet/20 hover:border-scarlet/60 active:bg-scarlet/30',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'sm', kbd, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wider uppercase select-none transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3',
        size === 'md' && 'h-10 px-4 text-[13px]',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      <span className="flex items-center gap-1.5">{children}</span>
      {kbd && (
        <span className="ml-2 -mr-1 px-1.5 py-px text-[10px] border border-current/30 opacity-70">
          {kbd}
        </span>
      )}
    </button>
  ),
)
Button.displayName = 'Button'
