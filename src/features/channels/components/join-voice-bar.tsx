import { MicOff, PhoneCall, PhoneOff, TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { sameRoomId } from '@/features/rooms'
import { micUnblockSteps, useVoiceSession, type VoiceStatus } from '@/features/voice'
import { cn } from '@/lib/utils'

const PROGRESS_TEXT: Partial<Record<VoiceStatus, string>> = {
  'requesting-mic': 'Allow microphone access in your browser to join.',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  connected: "You're in this channel",
}

interface JoinVoiceBarProps {
  channelId: string
  /** How many people are in the channel. */
  count: number
  onJoin: () => void
  className?: string
}

/**
 * Above the participant grid: "n in voice" with Join, your progress while joining, "You're in
 * this channel" once in, or what went wrong (mic blocked, couldn't join) with a retry.
 */
export function JoinVoiceBar({ channelId, count, onJoin, className }: JoinVoiceBarProps) {
  const status = useVoiceSession((s) =>
    s.channelId !== null && sameRoomId(s.channelId, channelId) ? s.status : 'idle',
  )
  const error = useVoiceSession((s) => s.error)
  const leave = useVoiceSession((s) => s.leave)

  if (status === 'mic-denied') {
    return (
      <Alert variant="destructive" className={cn('m-4 w-auto', className)}>
        <MicOff aria-hidden="true" />
        <AlertTitle>Hideout can't use your microphone</AlertTitle>
        <AlertDescription>{micUnblockSteps()}</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onJoin}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (status === 'disconnected' && error) {
    return (
      <Alert variant="destructive" className={cn('m-4 w-auto', className)}>
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>Not connected to voice</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onJoin}>
            Try again
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const progress = PROGRESS_TEXT[status]

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-4 py-2',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{progress ?? `${count} in voice`}</p>
      {status === 'connected' || status === 'reconnecting' ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void leave()}>
          <PhoneOff aria-hidden="true" />
          Leave voice
        </Button>
      ) : progress ? null : (
        <Button type="button" size="sm" onClick={onJoin}>
          <PhoneCall aria-hidden="true" />
          Join voice
        </Button>
      )}
    </div>
  )
}
