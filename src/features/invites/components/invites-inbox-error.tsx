import { useRouter } from '@tanstack/react-router'
import { Inbox, RotateCw, TriangleAlert } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface InvitesInboxErrorProps {
  error?: unknown
  className?: string
}

/** The inbox didn't load: says why and offers a retry. */
export function InvitesInboxError({ error, className }: InvitesInboxErrorProps) {
  const router = useRouter()
  const offline = error instanceof ApiError && error.code === 'NETWORK'

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <AppHeader title="Invites" icon={<Inbox aria-hidden="true" />} />
      <CenteredState
        role="alert"
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title={offline ? "Couldn't reach Hideout" : "Your invites didn't load"}
        description={
          offline ? 'Check your connection and try again.' : 'Something went wrong. Try again.'
        }
        actions={
          <Button type="button" onClick={() => void router.invalidate()}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </div>
  )
}
