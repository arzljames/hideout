import { PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface JoinVoiceBarProps {
  count: number
  className?: string
}

/** Above the participant grid when people are talking and you're not connected here. */
export function JoinVoiceBar({ count, className }: JoinVoiceBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-4 py-2',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{count} in voice</p>
      {/* TODO(livekit): request a voice token and connect (voice-realtime-engineer). */}
      <Button type="button" size="sm">
        <PhoneCall aria-hidden="true" />
        Join voice
      </Button>
    </div>
  )
}
