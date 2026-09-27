import { useEffect, useRef, useState } from 'react'
import { isolate } from '@/lib/bidi'
import { usePushToTalk, useVoiceShortcuts } from '../hooks/use-push-to-talk'
import { useVoiceSession, type VoiceStatus } from '../voice-session'

function announcement(previous: VoiceStatus, next: VoiceStatus, channelName: string | null) {
  if (next === 'connected') {
    if (previous === 'reconnecting') return 'Reconnected to voice.'
    return channelName ? `Joined voice in ${isolate(channelName)}.` : 'Joined voice.'
  }
  if (next === 'reconnecting') return 'Reconnecting to voice…'
  if (next === 'idle' && (previous === 'connected' || previous === 'reconnecting')) {
    return 'Left voice.'
  }
  // Kicked and lost connections are toasted; mic and join problems show an alert.
  return null
}

/**
 * App-wide voice behavior that must outlive every page: push-to-talk, the mute/deafen
 * shortcuts, and a polite live region announcing joined / left / reconnecting (never who's
 * speaking). Render once in the app shell.
 */
export function VoiceSessionEffects() {
  usePushToTalk()
  useVoiceShortcuts()
  const status = useVoiceSession((s) => s.status)
  const channelName = useVoiceSession((s) => s.channelName)
  const previous = useRef(status)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (previous.current === status) return
    const next = announcement(previous.current, status, channelName)
    previous.current = status
    if (next) setMessage(next)
  }, [status, channelName])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}
