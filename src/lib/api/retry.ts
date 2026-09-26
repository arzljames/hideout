import { ApiError } from './client'

/** Retry once for server errors and an unreachable API; never for 4xx (they won't change). */
export function retryTransient(failureCount: number, error: unknown): boolean {
  return (
    failureCount < 1 &&
    error instanceof ApiError &&
    (error.code === 'NETWORK' || error.status >= 500)
  )
}
