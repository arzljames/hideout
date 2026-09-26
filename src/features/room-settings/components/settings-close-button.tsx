import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SettingsCloseButtonProps {
  roomId: string
  /** The room's default channel; null goes to the room itself. */
  channelId: string | null
  /** Show the "Esc" caption under the button (desktop). */
  showCaption?: boolean
  className?: string
}

/** Round X back to the room, with an "Esc" hint (Esc does the same; see useEscapeToClose). */
export function SettingsCloseButton({
  roomId,
  channelId,
  showCaption = true,
  className,
}: SettingsCloseButtonProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <Button asChild variant="outline" size="icon-lg" shape="round">
        {channelId ? (
          <Link
            to="/rooms/$roomId/$channelId"
            params={{ roomId, channelId }}
            aria-label="Close settings"
            aria-keyshortcuts="Escape"
          >
            <X aria-hidden="true" />
          </Link>
        ) : (
          <Link
            to="/rooms/$roomId"
            params={{ roomId }}
            aria-label="Close settings"
            aria-keyshortcuts="Escape"
          >
            <X aria-hidden="true" />
          </Link>
        )}
      </Button>
      {showCaption && (
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          Esc
        </span>
      )}
    </div>
  )
}
