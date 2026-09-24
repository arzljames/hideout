import { Link } from '@tanstack/react-router'
import { DoorClosed } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SettingsUnavailableProps {
  className?: string
}

/**
 * Room settings for a missing room *or* one you're not in, with the same copy as the room
 * page, so it doesn't reveal which rooms exist. Full page (no app shell).
 */
export function SettingsUnavailable({ className }: SettingsUnavailableProps) {
  return (
    <main className={cn('flex min-h-svh flex-col bg-background', className)}>
      <CenteredState
        titleLevel={1}
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
    </main>
  )
}
