import { useEffect, useState } from 'react'
import { getLocalMicTrack, useVoiceSession } from '../voice-session'

/** Under reduced motion the meter updates a few times a second instead of every frame. */
const REDUCED_MOTION_INTERVAL_MS = 250

/**
 * The local mic's input level (0 to 1, after the input volume) while `active` and in voice;
 * `null` when there's no mic to measure. Polls LiveKit's audio analyser with
 * requestAnimationFrame and stops (closing the analyser) when inactive or unmounted.
 */
export function useMicLevel(active: boolean): number | null {
  const status = useVoiceSession((s) => s.status)
  const inputVolume = useVoiceSession((s) => s.inputVolume)
  const [level, setLevel] = useState<number | null>(null)
  const measuring = active && (status === 'connected' || status === 'reconnecting')

  useEffect(() => {
    const track = measuring ? getLocalMicTrack() : null
    if (!track) return
    let cancelled = false
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let cleanupAnalyser: (() => Promise<void>) | undefined
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    void import('livekit-client').then(({ createAudioAnalyser }) => {
      if (cancelled) return
      const { calculateVolume, cleanup } = createAudioAnalyser(track, { cloneTrack: true })
      cleanupAnalyser = cleanup
      const tick = () => {
        if (cancelled) return
        setLevel(Math.min(1, calculateVolume() * (inputVolume / 100) * 2))
        if (reduced) timer = setTimeout(tick, REDUCED_MOTION_INTERVAL_MS)
        else frame = requestAnimationFrame(tick)
      }
      tick()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      void cleanupAnalyser?.()
      setLevel(null)
    }
  }, [measuring, inputVolume])

  return measuring ? level : null
}
