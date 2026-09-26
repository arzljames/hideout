import { api, toApiError, withNetworkErrors } from '@/lib/api/client'
import { supabase } from '@/lib/supabase'
import { setRealtimeAccessToken } from './access-token'
import { createTokenManager, type RealtimeToken, type TokenManager } from './token-manager'

/** `idle`: stopped (signed out). `connecting`: waiting for the first token. `ready`: join away. */
export type RealtimeStatus = 'idle' | 'connecting' | 'ready'

let manager: TokenManager | null = null
let status: RealtimeStatus = 'idle'
const listeners = new Set<() => void>()

function setStatus(next: RealtimeStatus) {
  if (status === next) return
  status = next
  for (const listener of listeners) listener()
}

export function getRealtimeStatus(): RealtimeStatus {
  return status
}

/** Subscribe to status changes (for `useSyncExternalStore`). Returns the unsubscribe. */
export function subscribeRealtimeStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function fetchRealtimeToken(): Promise<RealtimeToken> {
  const result = await withNetworkErrors(() => api.GET('/api/auth/realtime-token'))
  if (result.data) return result.data
  throw toApiError(result)
}

let managerProfileId: string | null = null
let onRemoteSignOut: (() => void) | undefined

/**
 * What to do when another tab of this user signs out: the session cookie is shared, so this
 * tab is signed out too. Registered by the app entry (lib code never imports features).
 * Realtime is already stopped when it runs.
 */
export function setRealtimeSignedOutHandler(handler: (() => void) | undefined): void {
  onRemoteSignOut = handler
}

/** Tear down channels, socket, and token; `idle` also clears the topic registry. */
function teardown(announce: boolean) {
  manager?.stop({ announce })
  manager = null
  managerProfileId = null
  setRealtimeAccessToken(null)
  // First, so the topic registry forgets its channels before their CLOSED callbacks fire.
  setStatus('idle')
  void supabase.removeAllChannels().catch(() => {})
  void supabase.realtime.disconnect().catch(() => {})
}

/**
 * Start Realtime for the signed-in user: fetch (or adopt from another tab of the same user) a
 * token and keep it fresh. Topics wait for status `ready` before joining. Idempotent for the
 * same user, so StrictMode's double mount and switching layouts don't fetch twice; starts over
 * after a 401 or for a different user.
 */
export function startRealtime(profileId: string): void {
  if (manager && managerProfileId === profileId && manager.isActive()) return
  // A different user in this tab (or a dead manager): nothing of the old session carries over.
  if (manager) teardown(false)
  const instance = createTokenManager({
    profileId,
    fetchToken: fetchRealtimeToken,
    onToken: (token) => {
      if (manager !== instance) return
      setRealtimeAccessToken(token)
      // Sends the new token to every joined channel now, rather than at the next heartbeat.
      void supabase.realtime.setAuth(token).catch(() => {})
      setStatus('ready')
    },
    onSignedOut: () => {
      if (manager !== instance) return
      teardown(false)
      onRemoteSignOut?.()
    },
  })
  manager = instance
  managerProfileId = profileId
  setStatus('connecting')
  instance.start()
}

/**
 * Stop Realtime on sign-out or an expired session: leave every channel, close the socket, stop
 * the token manager (timers, cross-tab channel, lock), and forget the token. Tells this user's
 * other tabs to do the same (the session cookie is shared). Idempotent.
 */
export function stopRealtime(): void {
  if (!manager) return
  teardown(true)
}

/** Ask for a fresh token now (e.g. a join failed with a JWT error). Throttled by the manager. */
export function refreshRealtimeToken(): void {
  manager?.refreshNow()
}
