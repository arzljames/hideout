import { z } from 'zod'
import { ApiError } from '@/lib/api/client'
import type { components } from '@/lib/api/schema.gen'

export type RealtimeToken = components['schemas']['RealtimeToken']

/** Refresh this long before `expiresAt` (hideout-api asks for about a minute). */
export const REFRESH_BEFORE_EXPIRY_MS = 60_000
/** Never schedule a refresh sooner than this, so a short-lived token can't cause a hot loop. */
export const MIN_REFRESH_DELAY_MS = 5_000
/** Retry backoff after a failed fetch (429, 5xx, offline): exponential with jitter, capped. */
export const BACKOFF_BASE_MS = 2_000
export const BACKOFF_CAP_MS = 60_000
/** A new tab waits this long for another tab to share its token before fetching one. */
export const INITIAL_WAIT_MS = 300
/** A follower with no token after this long fetches one itself (the leader may be frozen). */
export const FOLLOWER_FIRST_TOKEN_TIMEOUT_MS = 10_000
/** A follower fetches itself if the leader hasn't shared a newer token this long before expiry. */
export const FOLLOWER_FALLBACK_BEFORE_EXPIRY_MS = 20_000
/** Forced refreshes (a JWT error on join) are ignored within this long of the last fetch. */
export const FORCED_REFRESH_MIN_INTERVAL_MS = 30_000

/** Longest lifetime accepted for any token (the API issues 15 minutes). */
export const MAX_TOKEN_LIFETIME_MS = 2 * 60 * 60_000
/** Longest token accepted (a Supabase JWT is well under 2 KB). */
export const MAX_TOKEN_LENGTH = 8_192

/** Per-user names: tabs share a token only with tabs signed in as the same user. */
export const tokenLockName = (profileId: string) => `hideout:realtime-token:${profileId}`
export const tokenChannelName = (profileId: string) => `hideout-realtime:${profileId}`

/** The subset of `navigator.locks` used here. */
export interface LockManagerLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: () => Promise<void>,
  ): Promise<unknown>
}

/** The subset of `BroadcastChannel` used here. */
export interface ChannelLike {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: MessageEvent) => void) | null
}

export interface TokenManagerOptions {
  /** The signed-in user. Tokens for anyone else (JWT `sub`, tab messages) are refused. */
  profileId: string
  /** Another tab of this user signed out (the session cookie is shared, so this tab is too). */
  onSignedOut?: () => void
  /** Fetch a fresh token (`GET /api/auth/realtime-token`). Rejects with ApiError on failure. */
  fetchToken: () => Promise<RealtimeToken>
  /** Called with every token this tab adopts (fetched here or shared by another tab). */
  onToken: (token: string) => void
  /** Leader election across tabs; `null` disables sharing. Defaults to `navigator.locks`. */
  locks?: LockManagerLike | null
  /** Cross-tab messages; returning `null` disables sharing. Defaults to `BroadcastChannel`. */
  openChannel?: (name: string) => ChannelLike | null
  /** For tests. Defaults to Math.random. */
  random?: () => number
}

export interface TokenManager {
  start(): void
  /** `announce`: tell this user's other tabs to sign out too (a sign-out, not a user switch). */
  stop(options?: { announce?: boolean }): void
  /** False once stopped, or after a 401 (signed out): start a new manager to go again. */
  isActive(): boolean
  /**
   * Ask for a new token now, e.g. after a join failed with a JWT error. Throttled; in a
   * follower tab it asks the leader instead.
   */
  refreshNow(): void
  /** The token this tab holds (memory only). */
  current(): RealtimeToken | null
}

/** Messages between tabs on the `hideout-realtime` BroadcastChannel. */
const tabMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    profileId: z.string(),
    token: z.string().min(1).max(MAX_TOKEN_LENGTH),
    expiresAt: z.iso.datetime({ offset: true }),
  }),
  z.object({ type: z.literal('request'), profileId: z.string() }),
  z.object({ type: z.literal('refresh'), profileId: z.string() }),
  z.object({ type: z.literal('signout'), profileId: z.string() }),
])
type TabMessage = z.infer<typeof tabMessageSchema>
/** A message before `post` stamps it with this tab's profile id. */
type OutgoingMessage =
  | { type: 'token'; token: string; expiresAt: string }
  | { type: 'request' | 'refresh' | 'signout' }

type Role = 'solo' | 'leader' | 'follower'

function defaultLocks(): LockManagerLike | null {
  if (typeof navigator === 'undefined' || !('locks' in navigator) || !navigator.locks) return null
  return navigator.locks as LockManagerLike
}

function defaultOpenChannel(name: string): ChannelLike | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name)
}

function expiryOf(token: RealtimeToken): number {
  const ms = Date.parse(token.expiresAt)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * The JWT's `sub` claim, or null if the token isn't a readable JWT. Not a verification (the
 * server does that); it only stops this tab from using a token issued to someone else.
 */
export function tokenSubject(token: string): string | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof claims !== 'object' || claims === null || !('sub' in claims)) return null
    return typeof claims.sub === 'string' ? claims.sub : null
  } catch {
    return null
  }
}

/** Exponential backoff with "equal jitter": half fixed, half random. `attempt` starts at 1. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))
  return ceiling / 2 + random() * (ceiling / 2)
}

/**
 * Keeps one Supabase Realtime token fresh, shared across tabs when the browser allows it:
 * - With `navigator.locks` and `BroadcastChannel`, the tab holding the
 *   `hideout:realtime-token:<profileId>` lock is the leader. It fetches and refreshes (at
 *   `expiresAt` − 60 s) and posts each token on the `hideout-realtime:<profileId>` channel. Other tabs adopt any newer token. A new tab asks for the
 *   current token and waits briefly before anyone fetches. When the leader closes, the next tab
 *   in the lock queue takes over with the token it already holds.
 * - A follower still fetches for itself if it has no token after 10 s, or the leader hasn't
 *   shared a newer one 20 s before expiry (a frozen background tab keeps holding the lock).
 * - Without either API, every tab manages its own token (still adopting newer ones it hears).
 * 401 stops fetching (the API client's 401 handler ends the session); 429 and other failures
 * back off exponentially with jitter up to ~60 s. Tokens are kept in memory only.
 * Sharing is per user: lock and channel names include the profile id, every message carries
 * it, and a token whose JWT `sub` isn't this user is refused. A `signout` message from another
 * tab of this user drops the token and reports `onSignedOut`.
 */
export function createTokenManager({
  profileId,
  onSignedOut,
  fetchToken,
  onToken,
  locks = defaultLocks(),
  openChannel = defaultOpenChannel,
  random = Math.random,
}: TokenManagerOptions): TokenManager {
  let started = false
  let stopped = false
  let role: Role = 'solo'
  let token: RealtimeToken | null = null
  let channel: ChannelLike | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  let waitingForPeers = false
  let fetching = false
  let unauthorized = false
  let failures = 0
  let lastFetchAt = Number.NEGATIVE_INFINITY
  let lockAbort: AbortController | undefined
  let releaseLock: (() => void) | undefined

  function post(message: OutgoingMessage) {
    const stamped: TabMessage = { ...message, profileId }
    channel?.postMessage(stamped)
  }

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function setTimer(delay: number, run: () => void) {
    clearTimer()
    timer = setTimeout(run, Math.max(0, delay))
  }

  /** Take `next` if it outlives the current token. Returns whether it was adopted. */
  function adopt(next: RealtimeToken, { share }: { share: boolean }): boolean {
    if (next.token.length > MAX_TOKEN_LENGTH) return false
    if (tokenSubject(next.token)?.toLowerCase() !== profileId.toLowerCase()) return false
    const now = Date.now()
    // Clamp: a bogus far-future expiry must not stop refreshes.
    const expiry = Math.min(expiryOf(next), now + MAX_TOKEN_LIFETIME_MS)
    if (expiry <= now) return false
    if (token && expiry <= expiryOf(token)) return false
    token = { token: next.token, expiresAt: new Date(expiry).toISOString() }
    if (waitingForPeers) endInitialWait()
    onToken(token.token)
    if (share) post({ type: 'token', ...token })
    schedule()
    return true
  }

  /** Arm the one timer for what this tab should do next. */
  function schedule() {
    if (stopped || unauthorized || waitingForPeers || fetching) return
    const now = Date.now()
    if (role === 'follower') {
      const delay = token
        ? expiryOf(token) - FOLLOWER_FALLBACK_BEFORE_EXPIRY_MS - now
        : FOLLOWER_FIRST_TOKEN_TIMEOUT_MS
      setTimer(Math.max(MIN_REFRESH_DELAY_MS, delay), () => void fetchNow())
      return
    }
    if (!token) {
      void fetchNow()
      return
    }
    const delay = expiryOf(token) - REFRESH_BEFORE_EXPIRY_MS - now
    setTimer(Math.max(MIN_REFRESH_DELAY_MS, delay), () => void fetchNow())
  }

  async function fetchNow() {
    if (stopped || unauthorized || fetching) return
    clearTimer()
    fetching = true
    lastFetchAt = Date.now()
    try {
      const next = await fetchToken()
      if (stopped) return
      fetching = false
      if (adopt(next, { share: true })) {
        failures = 0
        return
      }
      // Unusable (expired, or not this user's): retry with backoff rather than loop.
      failures += 1
      setTimer(backoffDelay(failures, random), () => void fetchNow())
    } catch (error) {
      if (stopped) return
      fetching = false
      if (error instanceof ApiError && error.status === 401) {
        // Signed out: the API client's 401 handler ends the session (and stops Realtime).
        unauthorized = true
        token = null
        clearTimer()
        return
      }
      failures += 1
      setTimer(backoffDelay(failures, random), () => void fetchNow())
    } finally {
      fetching = false
    }
  }

  function endInitialWait() {
    clearTimeout(initialTimer)
    initialTimer = undefined
    waitingForPeers = false
  }

  function onMessage(event: MessageEvent) {
    if (stopped) return
    const parsed = tabMessageSchema.safeParse(event.data)
    if (!parsed.success || parsed.data.profileId !== profileId) return
    const message = parsed.data
    switch (message.type) {
      case 'token':
        adopt({ token: message.token, expiresAt: message.expiresAt }, { share: false })
        return
      case 'request':
        if (!unauthorized && token && expiryOf(token) - Date.now() > MIN_REFRESH_DELAY_MS) {
          post({ type: 'token', ...token })
        }
        return
      case 'refresh':
        if (role === 'leader') refreshNow()
        return
      case 'signout':
        token = null
        unauthorized = true
        clearTimer()
        onSignedOut?.()
        return
    }
  }

  function refreshNow() {
    if (!started || stopped || unauthorized) return
    if (role === 'follower') {
      post({ type: 'refresh' })
      return
    }
    if (Date.now() - lastFetchAt < FORCED_REFRESH_MIN_INTERVAL_MS) return
    void fetchNow()
  }

  function start() {
    if (started) return
    started = true
    channel = openChannel(tokenChannelName(profileId))
    if (channel) channel.onmessage = onMessage

    if (!channel || !locks) {
      role = 'solo'
      schedule()
      return
    }

    role = 'follower'
    waitingForPeers = true
    post({ type: 'request' })
    initialTimer = setTimeout(() => {
      endInitialWait()
      schedule()
    }, INITIAL_WAIT_MS)

    lockAbort = new AbortController()
    locks
      .request(tokenLockName(profileId), { signal: lockAbort.signal }, () => {
        if (stopped) return Promise.resolve()
        role = 'leader'
        schedule()
        return new Promise<void>((resolve) => {
          releaseLock = resolve
        })
      })
      // AbortError when stopped while still queued for the lock.
      .catch(() => {})
  }

  function stop({ announce = false }: { announce?: boolean } = {}) {
    if (stopped) return
    stopped = true
    clearTimer()
    endInitialWait()
    if (channel) {
      if (announce) post({ type: 'signout' })
      channel.onmessage = null
      channel.close()
      channel = null
    }
    lockAbort?.abort()
    releaseLock?.()
    releaseLock = undefined
    token = null
  }

  return {
    start,
    stop,
    refreshNow,
    isActive: () => started && !stopped && !unauthorized,
    current: () => token,
  }
}
