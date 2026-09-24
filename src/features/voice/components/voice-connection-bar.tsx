import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Signal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useVoiceStore } from '../voice-store'
import { VoiceSettingsDialog } from './voice-settings-dialog'

interface VoiceConnectionBarProps {
  className?: string
}

/**
 * Connection status and voice controls, above the user card. Renders nothing while not
 * connected to a voice channel.
 */
export function VoiceConnectionBar({ className }: VoiceConnectionBarProps) {
  const connection = useVoiceStore((s) => s.connection)
  const muted = useVoiceStore((s) => s.muted)
  const deafened = useVoiceStore((s) => s.deafened)
  const toggleMute = useVoiceStore((s) => s.toggleMute)
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen)

  if (!connection) return null

  return (
    <section
      aria-label="Voice connection"
      className={cn('flex flex-col gap-2 border-b border-sidebar-border pb-2', className)}
    >
      <div className="flex items-center gap-2 px-1">
        <Signal aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-medium text-primary">Connected</p>
          <p className="truncate text-xs text-muted-foreground">
            {connection.channelName} · {connection.roomName}
          </p>
        </div>
        {/* TODO(livekit): map ConnectionQuality to Good / Poor / Lost. */}
        <span className="text-xs text-muted-foreground">
          <span className="sr-only">Connection quality: </span>Good
        </span>
      </div>

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
            {/* TODO(livekit): disconnect from the Room and clear the connection. */}
            <Button
              type="button"
              variant="destructive-solid"
              aria-label="Disconnect"
              className="ml-auto flex-1"
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
