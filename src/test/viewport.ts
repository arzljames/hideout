/**
 * Run the enclosing describe block at a given window width. `useIsMobile` reads
 * `window.innerWidth` (< 768 is mobile) when it mounts, so set it before rendering.
 */
export function withViewportWidth(width: number) {
  let originalWidth: number

  beforeEach(() => {
    originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalWidth,
    })
  })
}
