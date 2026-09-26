import type { QueryClient } from '@tanstack/react-query'
import type { RegisteredRouter } from '@tanstack/react-router'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { setRealtimeSignedOutHandler, stopRealtime } from '@/lib/realtime/connection'
import { endSession, meQueryOptions } from './api'
import { SIGNED_IN_LAYOUT_IDS } from './require-viewer'

type SessionRouter = Pick<RegisteredRouter, 'navigate' | 'invalidate' | 'state'>

/**
 * Wire what happens when the session ends outside this tab's control: any request other than
 * `GET /api/auth/me` coming back 401, or another tab of this user signing out (the session
 * cookie is shared, so this tab is signed out too). Inside the app that ends the session and
 * goes to /sign-in; on public pages (sign-in, invite) it stops Realtime, marks the user signed
 * out, and re-runs the route guards.
 */
export function registerSessionExpiry(queryClient: QueryClient, router: SessionRouter) {
  const sessionEnded = () => {
    const inApp = router.state.matches.some((match) =>
      (SIGNED_IN_LAYOUT_IDS as readonly string[]).includes(match.routeId),
    )
    if (!inApp) {
      stopRealtime()
      queryClient.setQueryData(meQueryOptions.queryKey, null)
      void router.invalidate()
      return
    }
    void endSession(queryClient, () => router.navigate({ to: '/sign-in', replace: true }))
  }
  setUnauthenticatedHandler(sessionEnded)
  setRealtimeSignedOutHandler(sessionEnded)
}
