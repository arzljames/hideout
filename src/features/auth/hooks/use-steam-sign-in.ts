import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { meQueryOptions } from '../api'
import {
  AUTH_CHANNEL_NAME,
  AUTH_SIGNAL_KEY,
  authSignalSchema,
  openSteamSignIn,
} from '../steam-popup'

interface SteamSignInState {
  /** A sign-in attempt was made from this screen (so older URL errors no longer apply). */
  started: boolean
  /** Waiting for the Steam tab to report back. */
  waiting: boolean
  /** `auth_error` code reported by this screen's Steam tab. */
  authError: string | undefined
}

const initialState: SteamSignInState = { started: false, waiting: false, authError: undefined }

/**
 * For the sign-in screen: start Steam sign-in in a new tab and react when it finishes.
 * - The Steam tab announces its result (BroadcastChannel + a localStorage `storage` event); any
 *   result refreshes the session, and a success goes Home once `me` confirms it. Errors show only
 *   for this screen's own attempt (matching nonce). A `signed-in` announcement from any tab also
 *   refreshes.
 * - Returning to this tab (focus / visibilitychange) also refreshes, as a backup.
 */
export function useSteamSignIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [state, setState] = useState(initialState)
  const pendingNonce = useRef<string | null>(null)

  const refreshSession = useCallback(
    async (goHomeIfSignedIn = true) => {
      await queryClient.refetchQueries({ queryKey: meQueryOptions.queryKey, type: 'all' })
      if (goHomeIfSignedIn && queryClient.getQueryData(meQueryOptions.queryKey)) {
        await navigate({ to: '/', replace: true })
      }
    },
    [queryClient, navigate],
  )

  useEffect(() => {
    // Backup for a missed announcement: re-check whenever the user comes back to this tab.
    const onReturn = () => {
      if (document.visibilityState === 'visible') void refreshSession()
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)

    const onSignal = (data: unknown) => {
      const parsed = authSignalSchema.safeParse(data)
      if (!parsed.success) return
      const signal = parsed.data
      if (signal.type === 'signed-in') {
        void refreshSession()
        return
      }
      if (signal.nonce === pendingNonce.current) {
        pendingNonce.current = null
        setState({ started: true, waiting: false, authError: signal.authError })
      }
      void refreshSession(!signal.authError)
    }

    let channel: BroadcastChannel | undefined
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<unknown>) => onSignal(event.data)
    }

    // The same announcement also arrives as a localStorage write from the other tab.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SIGNAL_KEY || !event.newValue) return
      try {
        onSignal(JSON.parse(event.newValue))
      } catch {
        // Not JSON: ignore.
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('storage', onStorage)
      channel?.close()
    }
  }, [refreshSession])

  const start = useCallback(() => {
    const nonce = openSteamSignIn()
    // null: the tab was blocked and the page is navigating to Steam instead.
    if (!nonce) return
    pendingNonce.current = nonce
    setState({ started: true, waiting: true, authError: undefined })
  }, [])

  return { ...state, start }
}
