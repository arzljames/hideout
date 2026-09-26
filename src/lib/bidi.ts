/**
 * Wrap user-provided text (e.g. a channel name) in FIRST STRONG ISOLATE / POP DIRECTIONAL
 * ISOLATE, for plain-text strings (toasts, screen reader announcements) where `<bdi>` can't be
 * used. A bidi control or right-to-left text inside `text` then can't reorder what's around it.
 * In JSX, render the text inside `<bdi>` instead.
 */
export function isolate(text: string): string {
  return `\u2068${text}\u2069`
}
