import { z } from 'zod'
import type { components } from '@/lib/api/schema.gen'

type AuthRedirectError = components['schemas']['AuthRedirectError']

/**
 * `?auth_error=` as set by hideout-api after a failed Steam sign-in. Only code-shaped values are
 * kept; anything else is dropped rather than failing the route. Unknown codes are still allowed
 * through and get the generic message.
 */
export const authErrorSearchSchema = z.object({
  auth_error: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
    .optional()
    .catch(undefined),
})

export type AuthErrorSearch = z.infer<typeof authErrorSearchSchema>

const AUTH_ERROR_MESSAGES: Record<AuthRedirectError, string> = {
  STEAM_LOGIN_FAILED: "Steam sign-in didn't go through. Please try again.",
  LOGIN_STATE_MISMATCH: 'That sign-in link expired. Please sign in again.',
  STEAM_UNAVAILABLE: "Steam isn't responding right now. Try again in a moment.",
  LOGIN_FAILED: 'Something went wrong on our side. Please try again.',
  RATE_LIMITED: 'Too many sign-in attempts. Wait a minute and try again.',
}

const GENERIC_AUTH_ERROR_MESSAGE = "Sign-in didn't work. Please try again."

function isKnownAuthError(code: string): code is AuthRedirectError {
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code)
}

/** User-facing copy for an `auth_error` code; unknown codes get a generic message. */
export function authErrorMessage(code: string): string {
  return isKnownAuthError(code) ? AUTH_ERROR_MESSAGES[code] : GENERIC_AUTH_ERROR_MESSAGE
}
