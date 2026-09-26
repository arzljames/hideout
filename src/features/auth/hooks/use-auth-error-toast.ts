import { toast } from 'sonner'
import { authErrorMessage } from '../auth-errors'
import { useConsumeAuthError } from './use-consume-auth-error'

/**
 * For signed-in screens: the API can redirect to `/?auth_error=...` while a session already
 * exists. Toast the message once, then `strip` the param from the URL.
 */
export function useAuthErrorToast(code: string | undefined, strip: () => void) {
  useConsumeAuthError(code, (consumed) => {
    // Stable id: a repeat (e.g. StrictMode) updates the same toast instead of stacking another.
    toast.error(authErrorMessage(consumed), { id: 'auth-error' })
    strip()
  })
}
