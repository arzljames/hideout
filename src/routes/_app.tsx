import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireViewer, useSessionGuard } from '@/features/auth'
import { useRealtimeConnection, useUserEvents } from '@/features/realtime'
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
  const { me } = Route.useRouteContext()
  useRealtimeConnection(me.id)
  useUserEvents(me.id)

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
