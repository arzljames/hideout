import { CircleAlert, LogIn } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { apiUrl } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { authErrorMessage } from '../auth-errors'
import { BrandAvatars } from './brand-avatars'

interface SignInScreenProps {
  /** `auth_error` code from a failed Steam sign-in; unknown codes show a generic message. */
  authError?: string
  className?: string
}

export function SignInScreen({ authError, className }: SignInScreenProps) {
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

        {/* Same-tab, full-page navigation: the API redirects back to `/` or `/?auth_error=`. */}
        <Button asChild size="lg" className={cn('w-full', authError ? 'mt-4' : 'mt-8')}>
          <a href={apiUrl('/api/auth/steam')}>
            <LogIn aria-hidden="true" />
            Sign in with Steam
          </a>
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Hideout only reads your public profile: name, avatar and current game.
        </p>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">Powered by Steam</footer>
    </div>
  )
}
