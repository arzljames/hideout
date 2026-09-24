import { Link } from '@tanstack/react-router'
import { DoorClosed } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RoomNotFoundProps {
  className?: string
}

/**
 * Shown for a missing room *and* a room you're not in, with the same copy, so the page
 * doesn't reveal which rooms exist.
 */
export function RoomNotFound({ className }: RoomNotFoundProps) {
  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <AppHeader title="Room not available" />
      <CenteredState
        tone="muted"
        icon={<DoorClosed aria-hidden="true" />}
        title="This room isn't available"
        description="It may have been deleted, or you don't have access. Ask someone inside for an invite, or head back to Home."
        actions={
          <Button asChild>
            <Link to="/">Go to Home</Link>
          </Button>
        }
      />
    </div>
  )
}
