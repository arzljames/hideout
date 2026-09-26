import { CircleAlert, LogIn } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { authErrorMessage } from '../auth-errors'
import { openSteamSignIn } from '../steam-popup'
import { BrandAvatars } from './brand-avatars'

interface SignInScreenProps {
  /** `auth_error` code from a failed Steam sign-in; unknown codes show a generic message. */
  authError?: string
  /** Starts Steam sign-in. Defaults to opening the popup with no waiting state. */
  onSignIn?: () => void
  /** A popup is open and we're waiting for it to report back. */
  waiting?: boolean
  className?: string
}

export function SignInScreen({
  authError,
  onSignIn = openSteamSignIn,
  waiting = false,
  className,
}: SignInScreenProps) {
  return (
    <div className={cn('relative flex min-h-svh flex-col', className)}>
      <header className="absolute top-4 right-4">
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <BrandAvatars />
        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight">Hideout</h1>
        <p className="mt-2 max-w-80 text-sm text-muted-foreground">
          Private rooms for your squad. Text and voice, invite only.
        </p>

        {authError && (
          <Alert variant="destructive" className="mt-6">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Couldn&apos;t sign you in</AlertTitle>
            <AlertDescription>{authErrorMessage(authError)}</AlertDescription>
          </Alert>
        )}

        {/* Opens Steam in a popup; stays enabled so a closed popup can be reopened. */}
        <Button
          type="button"
          size="lg"
          className={cn('w-full', authError ? 'mt-4' : 'mt-8')}
          onClick={() => onSignIn()}
        >
          <LogIn aria-hidden="true" />
          Sign in with Steam
        </Button>
        {/* Always mounted, so the message is announced when it appears. */}
        <p role="status" aria-live="polite" className="mt-3 min-h-4 text-xs text-muted-foreground">
          {waiting ? 'Finish signing in in the Steam tab.' : null}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Hideout only reads your public profile: name, avatar and current game.
        </p>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">Powered by Steam</footer>
    </div>
  )
}
