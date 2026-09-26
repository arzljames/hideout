import createClient, { type Middleware } from 'openapi-fetch'
import { env } from '@/lib/env'
import type { components, paths } from './schema.gen'

type ErrorBody = components['schemas']['ErrorResponse']
export type ApiErrorDetails = ErrorBody['error']['details']

/** An API failure: `status` 0 with code `NETWORK` when the request never got a response. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorDetails

  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const { error } = value
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

/** Turn an openapi-fetch error result into an ApiError. Unknown bodies get code `UNKNOWN`. */
export function toApiError({ error, response }: { error?: unknown; response: Response }): ApiError {
  if (isErrorBody(error)) {
    return new ApiError(response.status, error.error.code, error.error.message, error.error.details)
  }
  return new ApiError(response.status, 'UNKNOWN', `Request failed with status ${response.status}`)
}

/**
 * Run an API call, turning a failed fetch (offline, DNS, CORS) into an ApiError with code
 * `NETWORK`. Aborts are rethrown untouched so TanStack Query can treat them as cancellations.
 */
export async function withNetworkErrors<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    const error = new ApiError(0, 'NETWORK', "Couldn't reach Hideout.")
    error.cause = cause
    throw error
  }
}

/** Absolute (or same-origin relative) URL for a full-page navigation to the API, e.g. Steam sign-in. */
export function apiUrl(path: keyof paths): string {
  return `${env.VITE_API_URL ?? ''}${path}`
}

let onUnauthenticated: (() => void) | undefined

/**
 * Called when any request other than `GET /api/auth/me` comes back 401 (the session ended).
 * Registered by the app entry, so lib code never imports features.
 */
export function setUnauthenticatedHandler(handler: (() => void) | undefined) {
  onUnauthenticated = handler
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const middleware: Middleware = {
  onRequest({ request }) {
    // The API's CSRF check requires JSON content type on writes, even without a body.
    if (MUTATING_METHODS.has(request.method) && !request.headers.has('Content-Type')) {
      request.headers.set('Content-Type', 'application/json')
    }
    return request
  },
  onResponse({ response, schemaPath }) {
    if (response.status === 401 && schemaPath !== '/api/auth/me') onUnauthenticated?.()
    return response
  },
}

/** Typed client for hideout-api, generated from its OpenAPI contract. */
export const api = createClient<paths>({
  baseUrl: env.VITE_API_URL ?? '',
  credentials: 'include',
  // Resolve fetch per call rather than capturing it at import, so test interceptors (MSW) apply.
  fetch: (request) => globalThis.fetch(request),
})

api.use(middleware)
