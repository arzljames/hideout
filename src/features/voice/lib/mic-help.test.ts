import { micUnblockSteps } from './mic-help'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const EDGE = `${CHROME} Edg/126.0.0.0`
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const FIREFOX_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15'
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

describe('micUnblockSteps', () => {
  it('points Firefox users (desktop and iOS) at the crossed-out mic icon', () => {
    expect(micUnblockSteps(FIREFOX)).toMatch(/crossed-out microphone icon/)
    expect(micUnblockSteps(FIREFOX_IOS)).toMatch(/crossed-out microphone icon/)
  })

  it("points Safari users at Safari's website settings", () => {
    expect(micUnblockSteps(SAFARI)).toMatch(/Safari menu/)
  })

  it.each([
    ['Chrome', CHROME],
    ['Edge', EDGE],
    ['Chrome on Android', CHROME_ANDROID],
    ['an unknown browser', ''],
  ])('points %s at the site settings icon', (_, userAgent) => {
    expect(micUnblockSteps(userAgent)).toMatch(/site settings icon/)
  })

  it('always ends with what to do next', () => {
    for (const userAgent of [CHROME, FIREFOX, SAFARI]) {
      expect(micUnblockSteps(userAgent)).toMatch(/then try again\.$/)
    }
  })
})
