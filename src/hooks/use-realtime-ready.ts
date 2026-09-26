import { useSyncExternalStore } from 'react'
import { getRealtimeStatus, subscribeRealtimeStatus } from '@/lib/realtime/connection'

/** Whether Realtime holds a token, so private topics can be joined. */
export function useRealtimeReady(): boolean {
  const status = useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus)
  return status === 'ready'
}
