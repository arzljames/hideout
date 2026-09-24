import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppHeader } from '@/components/app-header'
import { AppShell } from './app-shell'
import { CenteredState } from '@/components/centered-state'

interface AppNotFoundScreenProps {
  className?: string
}

/** Unknown page inside the app shell. */
export function AppNotFoundScreen({ className }: AppNotFoundScreenProps) {
  return (
    <AppShell className={className}>
      <AppHeader title="Page not found" />
      <CenteredState
        tone="muted"
        icon={<SearchX aria-hidden="true" />}
        title="There's nothing here"
        description="This page doesn't exist or the link is out of date. Check the address, or head back to Home."
        actions={
          <Button asChild>
            <Link to="/">Go to Home</Link>
          </Button>
        }
      />
    </AppShell>
  )
}
