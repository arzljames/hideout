import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppHeader } from './app-header'
import { AppShell } from './app-shell'
import { CenteredState } from './centered-state'

interface AppErrorScreenProps {
  className?: string
}

/** Route-level error inside the app shell: says what happened and offers a retry or a way home. */
export function AppErrorScreen({ className }: AppErrorScreenProps) {
  const router = useRouter()

  return (
    <AppShell className={className}>
      <AppHeader title="Something went wrong" />
      <CenteredState
        role="alert"
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title="This page didn't load"
        description="Something went wrong on our side. Try again, or head back to Home."
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
