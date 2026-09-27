import { cva } from 'class-variance-authority'
import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Signal,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { keyLabel } from '../voice-prefs'
import { ACTIVE_STATUSES, useVoiceSession, type VoiceStatus } from '../voice-session'
import { VoiceSettingsDialog } from './voice-settings-dialog'

const statusVariants = cva('text-sm font-medium', {
  variants: {
    tone: {
      connected: 'text-primary',
      pending: 'text-muted-foreground',
    },
  },
})

const STATUS_TEXT: Partial<Record<VoiceStatus, string>> = {
  'requesting-mic': 'Waiting for your mic…',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
}

const QUALITY_TEXT = { good: 'Good', poor: 'Poor', lost: 'Lost' } as const

interface VoiceConnectionBarProps {
  className?: string
}

/**
 * Connection status and voice controls, above the user card. Renders nothing unless joining
 * or in a voice channel.
 */
export function VoiceConnectionBar({ className }: VoiceConnectionBarProps) {
  const status = useVoiceSession((s) => s.status)
  const channelName = useVoiceSession((s) => s.channelName)
  const roomName = useVoiceSession((s) => s.roomName)
  const quality = useVoiceSession((s) => s.quality)
  const muted = useVoiceSession((s) => s.muted)
  const deafened = useVoiceSession((s) => s.deafened)
  const pushToTalk = useVoiceSession((s) => s.inputMode === 'push-to-talk')
  const pttKey = useVoiceSession((s) => s.pttKey)
  const audioBlocked = useVoiceSession((s) => s.audioBlocked)
  const toggleMute = useVoiceSession((s) => s.toggleMute)
  const toggleDeafen = useVoiceSession((s) => s.toggleDeafen)
  const leave = useVoiceSession((s) => s.leave)
  const startAudio = useVoiceSession((s) => s.startAudio)

  if (!ACTIVE_STATUSES.has(status)) return null

  return (
    <section
      aria-label="Voice connection"
      className={cn('flex flex-col gap-2 border-b border-sidebar-border pb-2', className)}
    >
      <div className="flex items-center gap-2 px-1">
        <Signal
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0',
            status === 'connected' ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className={statusVariants({ tone: status === 'connected' ? 'connected' : 'pending' })}>
            {STATUS_TEXT[status]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <bdi>{channelName}</bdi> · <bdi>{roomName}</bdi>
          </p>
        </div>
        {status === 'connected' && quality && (
          <span className="text-xs text-muted-foreground">
            <span className="sr-only">Connection quality: </span>
            {QUALITY_TEXT[quality]}
          </span>
        )}
      </div>

      {status === 'connected' && pushToTalk && !muted && (
        <p className="px-1 text-xs text-muted-foreground">
          Hold <Kbd>{keyLabel(pttKey)}</Kbd> to talk
        </p>
      )}

      {audioBlocked && (
        <Button type="button" variant="outline" size="sm" onClick={() => void startAudio()}>
          <Volume2 aria-hidden="true" />
          Turn on voice audio
        </Button>
      )}

      <div className="flex items-center gap-1">
        {/* Constant labels + aria-pressed: the pressed state carries "muted" / "deafened". */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              variant="voice"
              size="icon"
              aria-label="Mute"
              pressed={muted}
              onPressedChange={toggleMute}
            >
              {muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="top">{muted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              variant="voice"
              size="icon"
              aria-label="Deafen"
              pressed={deafened}
              onPressedChange={toggleDeafen}
            >
              {deafened ? <HeadphoneOff aria-hidden="true" /> : <Headphones aria-hidden="true" />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="top">{deafened ? 'Undeafen' : 'Deafen'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <VoiceSettingsDialog>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Voice settings">
                <Settings2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
          </VoiceSettingsDialog>
          <TooltipContent side="top">Voice settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="destructive-solid"
              aria-label="Disconnect"
              className="ml-auto flex-1"
              onClick={() => void leave()}
            >
              <PhoneOff aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Disconnect</TooltipContent>
        </Tooltip>
      </div>
    </section>
  )
}
