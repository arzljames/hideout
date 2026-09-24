interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string }
}

/** True on macOS (and iPadOS with a keyboard), where shortcuts use ⌘ instead of Ctrl. */
export function isApplePlatform(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return false
  const platform = (nav as NavigatorWithUAData).userAgentData?.platform ?? nav.platform ?? ''
  return /mac|iphone|ipad/i.test(platform)
}
