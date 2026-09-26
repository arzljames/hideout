import { Link, useRouter } from '@tanstack/react-router'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SettingsErrorProps {
  className?: string
}

/** Room settings failed to load: retry, or go home. Full page (no app shell). */
export function SettingsError({ className }: SettingsErrorProps) {
  const router = useRouter()

  return (
    <main className={cn('flex min-h-svh flex-col bg-background', className)}>
      <CenteredState
        role="alert"
        titleLevel={1}
        tone="destructive"
        icon={<TriangleAlert aria-hidden="true" />}
        title="Room settings didn't load"
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
    </main>
  )
}
