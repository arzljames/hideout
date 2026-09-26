/**
 * Move focus to the page's h1 inside <main> (e.g. the new room's channel heading after Create
 * room). Waits a frame so the navigated-to screen has rendered.
 */
export function focusMainHeading() {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('main h1[tabindex="-1"]')?.focus()
  })
}
