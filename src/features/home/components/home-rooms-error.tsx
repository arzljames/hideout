import { RotateCw, TriangleAlert } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface HomeRoomsErrorProps {
  error: unknown
  onRetry: () => void
  retrying: boolean
  className?: string
}

/** The room list failed to load: say why and offer a retry. */
export function HomeRoomsError({ error, onRetry, retrying, className }: HomeRoomsErrorProps) {
  const offline = error instanceof ApiError && error.code === 'NETWORK'

  return (
    <CenteredState
      role="alert"
      tone="destructive"
      className={cn(className)}
      icon={<TriangleAlert aria-hidden="true" />}
      title="Your rooms didn't load"
      description={
        offline
          ? "Couldn't reach Hideout. Check your connection and try again."
          : 'Something went wrong on our side. Try again in a moment.'
      }
      actions={
        <Button type="button" onClick={onRetry} disabled={retrying}>
          <RotateCw aria-hidden="true" className={cn(retrying && 'motion-safe:animate-spin')} />
          Try again
        </Button>
      }
    />
  )
}
