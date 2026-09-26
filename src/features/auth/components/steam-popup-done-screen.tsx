import { CircleAlert, CircleCheck } from 'lucide-react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SteamPopupDoneScreenProps {
  /** `auth_error` code the Steam flow ended with, if any. */
  authError?: string
  className?: string
}

/**
 * Shown inside the Steam popup only when the browser refused to close it. No router: the popup
 * never boots the app.
 */
export function SteamPopupDoneScreen({ authError, className }: SteamPopupDoneScreenProps) {
  const failed = authError !== undefined

  return (
    <main className={cn('flex min-h-svh flex-col bg-background text-foreground', className)}>
      <h1 className="sr-only">Hideout sign-in</h1>
      <CenteredState
        tone={failed ? 'destructive' : 'primary'}
        icon={failed ? <CircleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
        title={failed ? "Sign-in didn't finish" : "You're signed in"}
        description={
          failed
            ? 'You can close this tab and try again.'
            : 'You can close this tab.'
        }
        actions={
          <Button type="button" variant="outline" onClick={() => window.close()}>
            Close tab
          </Button>
        }
      />
    </main>
  )
}
