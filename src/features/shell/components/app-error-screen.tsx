import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/app-header'
import { AppShell } from './app-shell'
import { CenteredState } from '@/components/centered-state'
import { ApiError } from '@/lib/api/client'

interface AppErrorScreenProps {
  /** The route error; an unreachable API gets connection-specific copy. */
  error?: unknown
  className?: string
}

/** Route-level error inside the app shell: says what happened and offers a retry or a way home. */
export function AppErrorScreen({ error, className }: AppErrorScreenProps) {
  const router = useRouter()
  const offline = error instanceof ApiError && error.code === 'NETWORK'

  return (
    <AppShell className={className}>
      <AppHeader title="Something went wrong" />
      <CenteredState
        role="alert"
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title={offline ? "Couldn't reach Hideout" : "This page didn't load"}
        description={
          offline
            ? 'Check your connection and try again.'
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
    </AppShell>
  )
}
