import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const DOT_DELAYS = ['[animation-delay:-0.3s]', '[animation-delay:-0.15s]', '']

interface TypingIndicatorProps {
  /** Display names of people typing (not including you). */
  names: string[]
  className?: string
}

/** "Alex is typing…" line. The live region stays mounted so changes are announced. */
export function TypingIndicator({ names, className }: TypingIndicatorProps) {
  return (
    <div
      aria-live="polite"
      className={cn('flex h-6 items-center gap-2 px-4 text-xs text-muted-foreground', className)}
    >
      {names.length > 0 && (
        <>
          <span aria-hidden="true" className="flex items-center gap-0.5">
            {DOT_DELAYS.map((delay, index) => (
              <span
                key={index}
                className={cn('size-1 rounded-full bg-muted-foreground motion-safe:animate-bounce', delay)}
              />
            ))}
          </span>
          <span>
            {typingNames(names)} {names.length === 1 ? 'is' : 'are'} typing…
          </span>
        </>
      )}
    </div>
  )
}

/** "Alex", "Alex and Maya", or "Several people", with names emphasised. */
function typingNames(names: string[]): ReactNode {
  const strong = (name: string) => (
    <strong key={name} className="font-semibold text-foreground">
      {name}
    </strong>
  )
  const [first = '', second = ''] = names
  if (names.length === 1) return strong(first)
  if (names.length === 2) return [strong(first), ' and ', strong(second)]
  return 'Several people'
}
