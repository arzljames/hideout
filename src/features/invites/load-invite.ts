import type { QueryClient } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { meQueryOptions } from '@/features/auth'
import { ApiError } from '@/lib/api/client'
import { invitePreviewQueryOptions } from './api'
import { ensureNoReferrerMeta } from './no-referrer'

/**
 * Loader for `/invite/$token`: the preview (a 404 throws `notFound()`, the "invalid invite"
 * screen) and, alongside it, who's signed in. `me` failing (offline, 5xx) doesn't block the
 * page; it renders as signed out. Safe to run on hover (preload).
 */
export async function loadInvite(queryClient: QueryClient, token: string): Promise<void> {
  // Before any request goes out from this URL.
  ensureNoReferrerMeta()
  const me = queryClient.ensureQueryData(meQueryOptions).catch(() => null)
  try {
    await queryClient.ensureQueryData(invitePreviewQueryOptions(token))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound()
    throw error
  }
  await me
}
