import { cn } from '@/lib/utils'

const SEGMENTS = 24

interface MicMeterProps {
  /** 0 to 1, or null when there's no mic to measure (all segments off). */
  level: number | null
  className?: string
}

/** Decorative segmented input-level bar. The caption next to it explains what it shows. */
export function MicMeter({ level, className }: MicMeterProps) {
  const lit = level === null ? 0 : Math.round(Math.min(1, Math.max(0, level)) * SEGMENTS)

  return (
    <div aria-hidden="true" className={cn('flex h-2 gap-0.5', className)}>
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span
          key={index}
          data-lit={index < lit || undefined}
          className="flex-1 rounded-full bg-muted data-lit:bg-primary"
        />
      ))}
    </div>
  )
}
