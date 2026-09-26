import { z } from 'zod'
import { apiUrl } from '@/lib/api/client'
import { authErrorSearchSchema } from './auth-errors'

/*
 * Steam sign-in in a new tab.
 *
 * hideout-api sends `Cross-Origin-Opener-Policy: same-origin` on GET /api/auth/steam, which severs
 * the link between the app and the Steam tab: no `window.opener`, no `postMessage` to it, no reliable
 * `popup.closed`, and `window.name` is cleared. What does survive is the sessionStorage copy the
 * browser makes for a `window.open`ed window, and same-origin cross-tab messaging. So:
 * - the app writes a nonce to its sessionStorage, opens the tab (which gets a copy), then
 *   removes the nonce from its own storage;
 * - when the API redirects the tab back to the app, main.tsx finds the nonce, announces the
 *   result, and closes the tab instead of booting the app;
 * - if the nonce didn't survive, the tab boots the app signed in, and `_app` announces
 *   `signed-in` so the sign-in tab still picks it up.
 * Announcements go out on BroadcastChannel and as a localStorage `storage` event: the storage
 * write is synchronous, so it isn't lost when the tab closes right after.
 */

const STORAGE_KEY = 'hideout:steam-popup'
const WINDOW_NAME = 'hideout-steam-sign-in'

export const AUTH_CHANNEL_NAME = 'hideout-auth'
export const AUTH_SIGNAL_KEY = 'hideout:auth-signal'
/** Give the announcement a moment to leave before the tab closes. */
const CLOSE_DELAY_MS = 150

/** What a tab announces to other tabs about sign-in. */
export const authSignalSchema = z.discriminatedUnion('type', [
  // The Steam tab landed back on the app with this attempt's result.
  z.object({
    type: z.literal('steam-sign-in'),
    nonce: z.string().min(1),
    authError: authErrorSearchSchema.shape.auth_error,
  }),
  // A tab booted the app with a session (covers a Steam tab that lost its nonce).
  z.object({ type: z.literal('signed-in') }),
])

export type AuthSignal = z.infer<typeof authSignalSchema>

/** Tell other tabs of this origin about sign-in, over both channels (receivers dedupe). */
export function announceAuthSignal(signal: AuthSignal) {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
    channel.postMessage(signal)
    channel.close()
  }
  try {
    // `at` makes every write a change, so the `storage` event fires even for a repeat signal.
    window.localStorage.setItem(AUTH_SIGNAL_KEY, JSON.stringify({ ...signal, at: Date.now() }))
    window.localStorage.removeItem(AUTH_SIGNAL_KEY)
  } catch {
    // Storage unavailable; BroadcastChannel and the focus check remain.
  }
}

let announcedSignedIn = false

/** Announce `signed-in` once per page load. */
export function announceSignedInOnce() {
  if (announcedSignedIn) return
  announcedSignedIn = true
  announceAuthSignal({ type: 'signed-in' })
}

function removeNonce() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (privacy mode); nothing to clean up.
  }
}

/**
 * Open Steam sign-in in a new tab. Returns the nonce identifying this attempt, or `null` when the
 * tab was blocked and the browser is doing a full-page sign-in instead.
 */
export function openSteamSignIn(): string | null {
  const url = apiUrl('/api/auth/steam')
  const nonce = crypto.randomUUID()
  let popup: Window | null = null

  try {
    window.sessionStorage.setItem(STORAGE_KEY, nonce)
    // Open blank first (same-origin, so we keep a handle and the sessionStorage copy), then cut
    // the opener before navigating. Pages in the Steam flow can't reach this tab even if a
    // response ever arrives without the API's COOP header.
    popup = window.open('', WINDOW_NAME)
    if (popup) {
      popup.opener = null
      popup.location.href = url
    }
  } catch {
    popup = null
  } finally {
    // Only the new tab's copy should keep the nonce, otherwise this tab would later mistake
    // itself for the Steam tab (e.g. after the full-page fallback below comes back).
    removeNonce()
  }

  if (!popup) {
    window.location.assign(url)
    return null
  }
  try {
    popup.focus()
  } catch {
    // Cross-origin-isolated proxies may refuse; the browser focuses new tabs anyway.
  }
  return nonce
}

/** Result of finishing the flow inside the popup. */
export interface SteamPopupResult {
  authError: string | undefined
}

/**
 * Call before booting the app. If this tab is the Steam sign-in tab coming back, broadcast the
 * outcome to the app, try to close, and return the result (so the caller can render a small
 * "you can close this tab" screen in case closing was blocked). Otherwise return `null`.
 */
export function completeSteamSignInPopup(): SteamPopupResult | null {
  let nonce: string | null
  try {
    nonce = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!nonce) return null
  removeNonce()

  const params = new URLSearchParams(window.location.search)
  const { auth_error: authError } = authErrorSearchSchema.parse({
    auth_error: params.get('auth_error') ?? undefined,
  })

  announceAuthSignal({ type: 'steam-sign-in', nonce, authError })

  window.setTimeout(() => window.close(), CLOSE_DELAY_MS)
  return { authError }
}
