/** How to unblock the microphone for this site, for the browser in use. */
export function micUnblockSteps(userAgent: string = globalThis.navigator?.userAgent ?? ''): string {
  if (/firefox|fxios/i.test(userAgent)) {
    return 'Click the crossed-out microphone icon in the address bar, clear the blocked permission, then try again.'
  }
  if (/safari/i.test(userAgent) && !/chrome|chromium|crios|edg|android/i.test(userAgent)) {
    return 'In the Safari menu, open Settings for this website, set Microphone to Allow, then try again.'
  }
  return 'Click the site settings icon at the left of the address bar, set Microphone to Allow, then try again.'
}
