import { useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useNoReferrer } from '../no-referrer'

interface InviteErrorProps {
  error?: unknown
  className?: string
}

/** The invite preview failed for a reason other than "invalid" (offline, 5xx, rate limit). */
export function InviteError({ error, className }: InviteErrorProps) {
  useNoReferrer()
  const router = useRouter()
  const offline = error instanceof ApiError && error.code === 'NETWORK'
  const limited = error instanceof ApiError && error.status === 429

  return (
    <main className={cn('flex min-h-svh flex-col bg-background', className)}>
      <CenteredState
        role="alert"
        titleLevel={1}
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title={offline ? "Couldn't reach Hideout" : "This invite didn't load"}
        description={
          offline
            ? 'Check your connection and try again.'
            : limited
              ? 'Too many tries. Wait a minute and try again.'
              : 'Something went wrong on our side. Try again in a moment.'
        }
        actions={
          <Button type="button" onClick={() => void router.invalidate()}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        }
      />
    </main>
  )
}
