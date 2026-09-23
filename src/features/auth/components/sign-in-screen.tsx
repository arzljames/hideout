import { LogIn } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BrandAvatars } from './brand-avatars'

interface SignInScreenProps {
  className?: string
}

export function SignInScreen({ className }: SignInScreenProps) {
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

        {/* TODO(auth): replace with <a href={`${env.VITE_API_URL}/api/auth/steam`}> via asChild */}
        <Button type="button" size="lg" className="mt-8 w-full">
          <LogIn aria-hidden="true" />
          Sign in with Steam
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Hideout only reads your public profile: name, avatar and current game.
        </p>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">Powered by Steam</footer>
    </div>
  )
}
