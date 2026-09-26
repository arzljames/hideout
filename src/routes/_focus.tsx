import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { requireViewer, useSessionGuard } from '@/features/auth'
import { AppErrorScreen, AppNotFoundScreen } from '@/features/shell'

/** Full-screen pages without the app shell (e.g. Room settings). */
export const Route = createFileRoute('/_focus')({
  beforeLoad: requireViewer,
  component: FocusLayout,
  // These render their own app shell, so they work outside one too.
  errorComponent: ({ error }) => <AppErrorScreen error={error} />,
  notFoundComponent: () => <AppNotFoundScreen />,
})

function FocusLayout() {
  useSessionGuard()

  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}
