// jsdom polyfills for browser APIs used by next-themes, Radix and our hooks.

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  })
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}

// TanStack Router's scroll restoration calls window.scrollTo, which jsdom doesn't implement.
window.scrollTo = () => {}

// @tanstack/react-virtual sizes its scroll element with offsetHeight, which jsdom reports as 0,
// so a virtualized list (the message log, in a ScrollArea viewport) would render no rows. Give
// ScrollArea viewports a screen-sized box; rows still measure 0, so every row renders.
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    if (this.getAttribute('data-slot') === 'scroll-area-viewport') return 800
    return (offsetHeight?.get?.call(this) as number | undefined) ?? 0
  },
})
