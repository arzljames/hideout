import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import type { components } from '@/lib/api/schema.gen'
import { resetVoiceStore } from '@/features/voice'
import { useVoiceSession } from '@/stores/voice-session'

export type Me = components['schemas']['Me']

/** Retry once for server errors and unreachable API; never for 4xx (they won't change). */
function retryTransient(failureCount: number, error: unknown): boolean {
  return (
    failureCount < 1 &&
    error instanceof ApiError &&
    (error.code === 'NETWORK' || error.status >= 500)
  )
}

/** The signed-in user, or `null` when signed out (401). Other failures throw an ApiError. */
export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'] as const,
  queryFn: async ({ signal }): Promise<Me | null> => {
    const result = await withNetworkErrors(() => api.GET('/api/auth/me', { signal }))
    if (result.data) return result.data
    if (result.response.status === 401) return null
    throw toApiError(result)
  },
  staleTime: 60_000,
  refetchOnWindowFocus: true,
  retry: retryTransient,
})

/** One teardown at a time: a 401 on logout triggers both the sign-out and the expiry path. */
let ending: Promise<void> | null = null

/**
 * The single session teardown, for sign-out and for an expired session:
 * 1. cancel in-flight queries and drop voice state,
 * 2. mark the user signed out (so /sign-in's guard doesn't bounce back to Home),
 * 3. navigate to /sign-in, which unmounts every `_app` observer,
 * 4. only then clear the remaining cached data, so nothing mounted refetches (and 401s) first.
 * The mutation cache is left alone, so an in-flight sign-out stays pending until navigation ends.
 */
export function endSession(
  queryClient: QueryClient,
  goToSignIn: () => Promise<unknown>,
): Promise<void> {
  ending ??= (async () => {
    try {
      await queryClient.cancelQueries()
      resetVoiceStore()
      useVoiceSession.getState().leave()
      queryClient.setQueryData(meQueryOptions.queryKey, null)
      await goToSignIn()
      queryClient.getQueryCache().clear()
      queryClient.setQueryData(meQueryOptions.queryKey, null)
    } finally {
      ending = null
    }
  })()
  return ending
}

/** Mutation keys, so the account menu can tell when any sign-out is in flight. */
export const signOutMutationKeys = {
  all: ['auth', 'sign-out'] as const,
  thisDevice: ['auth', 'sign-out', 'this-device'] as const,
  everywhere: ['auth', 'sign-out', 'everywhere'] as const,
}

const SIGN_OUT_FAILED_MESSAGE = "Couldn't sign you out. Check your connection and try again."

function useSignOutMutation(
  path: '/api/auth/logout' | '/api/auth/logout-all',
  mutationKey: readonly string[],
) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationKey,
    mutationFn: async () => {
      const result = await withNetworkErrors(() => api.POST(path))
      // 401: the session was already gone, which is what we wanted.
      if (result.response.status === 204 || result.response.status === 401) return
      throw toApiError(result)
    },
    // Returned promise: the mutation (and the disabled menu items) stays pending until the
    // teardown has navigated to /sign-in.
    onSuccess: () =>
      endSession(queryClient, () => navigate({ to: '/sign-in', replace: true })),
    onError: () => {
      toast.error(SIGN_OUT_FAILED_MESSAGE)
    },
  })
}

/** Sign out of this device. */
export function useSignOut() {
  return useSignOutMutation('/api/auth/logout', signOutMutationKeys.thisDevice)
}

/** Sign out of every device, including this one. */
export function useSignOutEverywhere() {
  return useSignOutMutation('/api/auth/logout-all', signOutMutationKeys.everywhere)
}
