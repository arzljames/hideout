import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import {
  announceSignedInOnce,
  authErrorSearchSchema,
  meQueryOptions,
  useSessionGuard,
} from '@/features/auth'
import { AppErrorScreen, AppNotFoundScreen, AppShell, AppShellSkeleton } from '@/features/shell'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    // 401 resolves to null; other failures (5xx, 429, offline) throw to errorComponent.
    const me = await context.queryClient.ensureQueryData(meQueryOptions)
    if (!me) {
      // The API can land a failed sign-in on `/?auth_error=...`; carry it to the sign-in screen.
      const { auth_error } = authErrorSearchSchema.parse(location.search)
      throw redirect({ to: '/sign-in', search: { auth_error } })
    }
    // Lets a sign-in tab waiting on Steam notice this session.
    announceSignedInOnce()
  },
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
