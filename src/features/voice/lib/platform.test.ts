import { isApplePlatform } from './platform'

function fakeNavigator(platform: string, uaPlatform?: string): Navigator {
  return {
    platform,
    ...(uaPlatform !== undefined && { userAgentData: { platform: uaPlatform } }),
  } as unknown as Navigator
}

describe('isApplePlatform', () => {
  it.each([
    ['MacIntel', undefined, true],
    ['iPhone', undefined, true],
    ['Win32', undefined, false],
    ['Linux x86_64', undefined, false],
    // userAgentData wins when present.
    ['', 'macOS', true],
    ['MacIntel', 'Windows', false],
  ])('platform %j / userAgentData %j → %s', (platform, uaPlatform, expected) => {
    expect(isApplePlatform(fakeNavigator(platform, uaPlatform))).toBe(expected)
  })
})
