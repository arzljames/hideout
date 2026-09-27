/*
 * The invite a signed-out visitor was looking at when they started Steam sign-in. Sign-in is a
 * full-page redirect: the API lands them on `/`, and Home sends them back to `/invite/<token>`.
 * sessionStorage: per tab, gone when the tab closes.
 */

const STORAGE_KEY = 'hideout:pending-invite'

export function storePendingInviteToken(token: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Storage unavailable (privacy mode): they land on Home and can reopen the invite link.
  }
}

export function clearPendingInviteToken(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Read and remove the stored token (one-shot). */
export function takePendingInviteToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(STORAGE_KEY)
    if (token) window.sessionStorage.removeItem(STORAGE_KEY)
    return token || null
  } catch {
    return null
  }
}
