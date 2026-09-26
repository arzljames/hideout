import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface RoomErrorProps {
  /** The route error; an unreachable API gets connection-specific copy. */
  error?: unknown
  className?: string
}

/** Room failed to load (not a 404): retry, or go home. Renders inside the app shell. */
export function RoomError({ error, className }: RoomErrorProps) {
  const router = useRouter()
  const offline = error instanceof ApiError && error.code === 'NETWORK'

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <AppHeader title="Something went wrong" />
      <CenteredState
        role="alert"
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title="This room didn't load"
        description={
          offline
            ? "Couldn't reach Hideout. Check your connection and try again."
            : 'Something went wrong on our side. Try again, or head back to Home.'
        }
        actions={
          <>
            <Button type="button" onClick={() => void router.invalidate()}>
              <RotateCw aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Go to Home</Link>
            </Button>
          </>
        }
      />
    </div>
  )
}
