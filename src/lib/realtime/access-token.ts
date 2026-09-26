/*
 * The Realtime JWT this tab currently holds, in memory only (never storage, never logged).
 * Its own module so `lib/supabase.ts` can read it without importing the connection.
 */

let current: string | null = null

export function getRealtimeAccessToken(): string | null {
  return current
}

export function setRealtimeAccessToken(token: string | null): void {
  current = token
}
