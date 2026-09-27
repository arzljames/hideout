import { Link } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNoReferrer } from '../no-referrer'

interface InviteInvalidProps {
  className?: string
}

/**
 * Any unusable link (unknown, expired, revoked, used up, deleted room): one message, since the
 * API deliberately doesn't say which.
 */
export function InviteInvalid({ className }: InviteInvalidProps) {
  useNoReferrer()
  return (
    <main className={cn('flex min-h-svh flex-col bg-background', className)}>
      <CenteredState
        titleLevel={1}
        tone="muted"
        icon={<LinkIcon aria-hidden="true" />}
        title="This invite isn't valid"
        description="It may have expired, been revoked, or reached its limit. Ask whoever sent it for a new link."
        actions={
          <Button asChild variant="outline">
            <Link to="/">Go to Home</Link>
          </Button>
        }
      />
    </main>
  )
}
