import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppErrorScreen, AppNotFoundScreen } from '@/features/shell'

/** Full-screen pages without the app shell (e.g. Room settings). */
export const Route = createFileRoute('/_focus')({
  // TODO(auth): both _app and _focus must call a shared `requireViewer(context, location)` in
  // beforeLoad: ensureQueryData(meQueryOptions), and on 401
  // throw redirect({ to: '/sign-in', search: { redirect: location.href } }). Add a route test
  // that /rooms/$roomId/settings redirects to /sign-in. In the same change, sign-in needs a
  // validateSearch that only accepts a same-origin `redirect` path.
  component: FocusLayout,
  // These render their own app shell, so they work outside one too.
  errorComponent: () => <AppErrorScreen />,
  notFoundComponent: () => <AppNotFoundScreen />,
})

function FocusLayout() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}
