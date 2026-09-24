import { cn } from '@/lib/utils'

const SEGMENTS = 24
/** Static sample level; TODO(livekit): drive from the local track's audio level. */
const SAMPLE_LIT = 9

interface MicMeterProps {
  className?: string
}

/** Decorative segmented input-level bar. The caption next to it explains what it shows. */
export function MicMeter({ className }: MicMeterProps) {
  return (
    <div aria-hidden="true" className={cn('flex h-2 gap-0.5', className)}>
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span
          key={index}
          data-lit={index < SAMPLE_LIT || undefined}
          className="flex-1 rounded-full bg-muted data-lit:bg-primary"
        />
      ))}
    </div>
  )
}
