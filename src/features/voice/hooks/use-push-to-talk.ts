import { useEffect } from 'react'
import { isApplePlatform } from '../lib/platform'
import { useVoiceSession } from '../voice-session'

/** Typing in a field must never open the mic or toggle mute. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** Controls where the key has its own meaning (e.g. Space presses a button). */
const INTERACTIVE =
  'button, a[href], [role="button"], [role="menuitem"], select, input, textarea, [contenteditable]'

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

/**
 * While in voice in push-to-talk mode: holding the key (outside text fields; repeats ignored)
 * opens the mic; releasing it, leaving the window or hiding the tab closes it. Only works while
 * Hideout is the focused tab (browsers don't give pages global key events).
 */
export function usePushToTalk(): void {
  const enabled = useVoiceSession(
    (s) =>
      s.inputMode === 'push-to-talk' && (s.status === 'connected' || s.status === 'reconnecting'),
  )
  const pttKey = useVoiceSession((s) => s.pttKey)

  useEffect(() => {
    if (!enabled) return
    const setActive = (active: boolean) => useVoiceSession.getState().setPttActive(active)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== pttKey || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      // Talk anyway, but never block a focused control's own use of the key.
      if (!isInteractiveTarget(event.target)) event.preventDefault()
      if (!event.repeat) setActive(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === pttKey) setActive(false)
    }
    const release = () => setActive(false)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [enabled, pttKey])
}

/** Ctrl+Shift+M / Ctrl+Shift+D (⌘ on Apple platforms) toggle mute / deafen while in voice. */
export function useVoiceShortcuts(): void {
  const inVoice = useVoiceSession((s) => s.status === 'connected' || s.status === 'reconnecting')

  useEffect(() => {
    if (!inVoice) return
    const mac = isApplePlatform()
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = mac ? event.metaKey : event.ctrlKey
      if (!modifier || !event.shiftKey || event.altKey || event.repeat) return
      if (isTypingTarget(event.target)) return
      const { toggleMute, toggleDeafen } = useVoiceSession.getState()
      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMute()
      } else if (event.code === 'KeyD') {
        event.preventDefault()
        toggleDeafen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inVoice])
}
