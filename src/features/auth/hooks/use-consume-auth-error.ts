import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { meQueryOptions } from '../api'

/**
 * Handle a one-shot `auth_error` search param: once per code, call `onConsume` (which should
 * strip the param from the URL) and re-fetch `GET /api/auth/me`, since a failed sign-in may have
 * changed the session. Returns the last code seen, so the
 * screen can keep showing it after the URL no longer has it.
 */
export function useConsumeAuthError(
  code: string | undefined,
  onConsume: (code: string) => void,
): string | undefined {
  const queryClient = useQueryClient()
  const [latched, setLatched] = useState(code)
  // Adjust state during render when a new code arrives, rather than in an effect.
  if (code !== undefined && code !== latched) setLatched(code)

  // Latest callback, so callers can pass an inline function without re-running the effect.
  const onConsumeRef = useRef(onConsume)
  useLayoutEffect(() => {
    onConsumeRef.current = onConsume
  })

  // StrictMode runs effects twice on mount; the ref keeps this to one call per code.
  const handled = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (code === undefined) {
      handled.current = undefined
      return
    }
    if (handled.current === code) return
    handled.current = code
    onConsumeRef.current(code)
    // `type: 'all'`: refetch even with no mounted observer (e.g. on /sign-in).
    void queryClient.refetchQueries({ queryKey: meQueryOptions.queryKey, type: 'all' })
  }, [code, queryClient])

  return latched
}
