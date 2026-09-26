import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

/** Open Radix layers that handle Escape themselves (dialogs, popovers, menus, selects). */
const LAYER_SELECTOR =
  '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'

/**
 * True for a text field with something in it: browsers use Esc there to clear the field
 * (e.g. type="search"), and closing would throw away what was typed.
 */
function isNonEmptyTextField(target: Element | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value !== ''
  }
  const editable = target?.closest('[contenteditable]:not([contenteditable="false"])')
  return Boolean(editable?.textContent)
}

/**
 * Esc closes Room settings (back to the room's default channel), unless something else
 * already handled it. Radix layers listen for Escape on the document in the capture phase
 * and call preventDefault when they dismiss, so this bubble-phase listener sees
 * `defaultPrevented`. As a second guard it ignores Escape while any layer is open or when
 * the key comes from inside one, during IME composition, and in a text field that has text
 * (Esc from an empty field still closes).
 */
export function useEscapeToClose(roomId: string, channelId: string) {
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(LAYER_SELECTOR) || document.querySelector(LAYER_SELECTOR)) return
      if (isNonEmptyTextField(target)) return
      void navigate({ to: '/rooms/$roomId/$channelId', params: { roomId, channelId } })
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navigate, roomId, channelId])
}
