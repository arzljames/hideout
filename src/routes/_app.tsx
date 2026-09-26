import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireViewer, useSessionGuard } from '@/features/auth'
import { AppErrorScreen, AppNotFoundScreen, AppShell, AppShellSkeleton } from '@/features/shell'

export const Route = createFileRoute('/_app')({
  beforeLoad: requireViewer,
  component: AppLayout,
  pendingComponent: () => <AppShellSkeleton />,
  errorComponent: ({ error }) => <AppErrorScreen error={error} />,
  notFoundComponent: () => <AppNotFoundScreen />,
})

function AppLayout() {
  useSessionGuard()

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
