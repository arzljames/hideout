import type { QueryClient } from '@tanstack/react-query'
import type { RegisteredRouter } from '@tanstack/react-router'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { endSession, meQueryOptions } from './api'

type SessionRouter = Pick<RegisteredRouter, 'navigate' | 'invalidate' | 'state'>

/**
 * Wire the API client's 401 handler: any request other than `GET /api/auth/me` coming back 401
 * means the session ended. Inside the app that ends the session and goes to /sign-in; on public
 * pages (sign-in, invite) it just marks the user signed out and re-runs the route guards.
 */
export function registerSessionExpiry(queryClient: QueryClient, router: SessionRouter) {
  setUnauthenticatedHandler(() => {
    const inApp = router.state.matches.some((match) => match.routeId === '/_app')
    if (!inApp) {
      queryClient.setQueryData(meQueryOptions.queryKey, null)
      void router.invalidate()
      return
    }
    void endSession(queryClient, () => router.navigate({ to: '/sign-in', replace: true }))
  })
}
