import { useEffect } from 'react'
import { startRealtime } from '@/lib/realtime/connection'

/**
 * Start Realtime for the signed-in user. Call in signed-in layouts (`_app`, `_focus`).
 * Deliberately no stop on unmount: the connection outlives layout switches and StrictMode
 * remounts, and stops only in the session teardown (`endSession`). A different user starts over.
 */
export function useRealtimeConnection(profileId: string): void {
  useEffect(() => {
    startRealtime(profileId)
  }, [profileId])
}
