import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

interface CardProps extends HTMLMotionProps<'section'> {
  label?: string
  trailing?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
  span?: 'sm' | 'md' | 'lg' | 'full' // grid spans, optional sugar
}

export function Card({ label, trailing, className, bodyClassName, children, span, ...rest }: CardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn(
        'card flex flex-col',
        span === 'sm' && 'col-span-3',
        span === 'md' && 'col-span-4',
        span === 'lg' && 'col-span-6',
        span === 'full' && 'col-span-12',
        className,
      )}
      {...rest}
    >
      {(label || trailing) && (
        <header className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-hairline">
          <span className="section-label">{label}</span>
          {trailing && <div className="flex items-center gap-2">{trailing}</div>}
        </header>
      )}
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </motion.section>
  )
}
