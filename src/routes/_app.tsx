import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppErrorScreen, AppNotFoundScreen, AppShell } from '@/features/shell'

export const Route = createFileRoute('/_app')({
  // TODO(auth): beforeLoad guard with context.queryClient.ensureQueryData(meQueryOptions);
  // on 401, throw redirect({ to: '/sign-in', search: { redirect: location.href } }).
  component: AppLayout,
  errorComponent: () => <AppErrorScreen />,
  notFoundComponent: () => <AppNotFoundScreen />,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
