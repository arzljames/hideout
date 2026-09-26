import type { QueryClient } from '@tanstack/react-query'
import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { meQueryOptions } from './api'
import { authErrorSearchSchema } from './auth-errors'
import { announceSignedInOnce } from './steam-popup'

/** Layout routes that require a signed-in user. */
export const SIGNED_IN_LAYOUT_IDS = ['/_app', '/_focus'] as const

interface RequireViewerOptions {
  context: { queryClient: QueryClient }
  location: ParsedLocation
}

/**
 * `beforeLoad` guard for signed-in layouts (`_app`, `_focus`). 401 resolves to null and redirects
 * to /sign-in; other failures (5xx, 429, offline) throw to the route's errorComponent.
 */
export async function requireViewer({ context, location }: RequireViewerOptions) {
  const me = await context.queryClient.ensureQueryData(meQueryOptions)
  if (!me) {
    // The API can land a failed sign-in on `/?auth_error=...`; carry it to the sign-in screen.
    // No `redirect` param: the API always lands sign-in on `/`, so it couldn't be honoured.
    const { auth_error } = authErrorSearchSchema.parse(location.search)
    throw redirect({ to: '/sign-in', search: { auth_error } })
  }
  // Lets a sign-in tab waiting on Steam notice this session.
  announceSignedInOnce()
  return { me }
}
