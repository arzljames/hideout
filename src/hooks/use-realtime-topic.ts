import { useEffect, useLayoutEffect, useRef } from 'react'
import { subscribeTopic, type TopicListener } from '@/lib/realtime/topics'
import { useRealtimeReady } from './use-realtime-ready'

/**
 * Listen on a private Realtime topic while mounted, once Realtime is ready. The listener may
 * change every render; the subscription only changes with `topic`. `null` pauses it.
 */
export function useRealtimeTopic(topic: string | null, listener: TopicListener): void {
  const ready = useRealtimeReady()
  const latest = useRef(listener)
  useLayoutEffect(() => {
    latest.current = listener
  })

  const active = ready ? topic : null
  useEffect(() => {
    if (!active) return
    return subscribeTopic(active, {
      onBroadcast: (event, payload) => latest.current.onBroadcast(event, payload),
      onStatus: (status) => latest.current.onStatus?.(status),
    })
  }, [active])
}
