import { vi } from 'vitest'
import { completeSteamSignInPopup, openSteamSignIn } from './steam-popup'

const STORAGE_KEY = 'hideout:steam-popup'
const STEAM_URL = 'http://api.test/api/auth/steam'

function setSearch(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

/** Collect messages on the app's auth channel (a separate instance, as another tab would be). */
function listenOnAuthChannel() {
  const channel = new BroadcastChannel('hideout-auth')
  const messages: unknown[] = []
  channel.onmessage = (event: MessageEvent<unknown>) => messages.push(event.data)
  return { channel, messages }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
  setSearch('')
})

describe('openSteamSignIn', () => {
  it('hands a nonce to the popup through sessionStorage, then removes its own copy', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('1111-2222-3333-4444-5555')
    // Only the fields openSteamSignIn touches.
    const popup = { focus: vi.fn(), opener: window, location: { href: '' } } as unknown as Window
    let storedDuringOpen: string | null = null
    const open = vi.spyOn(window, 'open').mockImplementation(() => {
      // The browser copies the opener's sessionStorage into the new window at this point.
      storedDuringOpen = window.sessionStorage.getItem(STORAGE_KEY)
      return popup
    })

    const nonce = openSteamSignIn()

    expect(nonce).toBe('1111-2222-3333-4444-5555')
    expect(storedDuringOpen).toBe(nonce)
    // Opened blank, detached from this tab, then sent to Steam.
    expect(open).toHaveBeenCalledWith('', 'hideout-steam-sign-in')
    expect(popup.opener).toBeNull()
    expect(popup.location.href).toBe(STEAM_URL)
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('falls back to a full-page sign-in when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    // jsdom's Location is unforgeable (assign can't be spied), so stub the global instead.
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    expect(openSteamSignIn()).toBeNull()

    expect(assign).toHaveBeenCalledWith(STEAM_URL)
    // Otherwise this window would treat itself as the popup when Steam sends it back.
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('completeSteamSignInPopup', () => {
  it('does nothing in a normal window', () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})

    expect(completeSteamSignInPopup()).toBeNull()
    expect(close).not.toHaveBeenCalled()
  })

  it('broadcasts a success with the nonce, clears it and closes the popup', async () => {
    const { channel, messages } = listenOnAuthChannel()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    window.sessionStorage.setItem(STORAGE_KEY, 'nonce-1')

    expect(completeSteamSignInPopup()).toEqual({ authError: undefined })

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    await vi.waitFor(() =>
      expect(messages).toEqual([{ type: 'steam-sign-in', nonce: 'nonce-1', authError: undefined }]),
    )
    // Closing waits a moment so the announcement isn't lost with the tab.
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1))
    channel.close()
  })

  it('also announces through a localStorage write, then removes it', () => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    window.sessionStorage.setItem(STORAGE_KEY, 'nonce-4')

    completeSteamSignInPopup()

    const write = setItem.mock.calls.find(([key]) => key === 'hideout:auth-signal')
    expect(JSON.parse(write?.[1] ?? '{}')).toMatchObject({ type: 'steam-sign-in', nonce: 'nonce-4' })
    expect(window.localStorage.getItem('hideout:auth-signal')).toBeNull()
  })

  it('broadcasts the auth_error from the URL', async () => {
    const { channel, messages } = listenOnAuthChannel()
    vi.spyOn(window, 'close').mockImplementation(() => {})
    window.sessionStorage.setItem(STORAGE_KEY, 'nonce-2')
    setSearch('?auth_error=RATE_LIMITED')

    expect(completeSteamSignInPopup()).toEqual({ authError: 'RATE_LIMITED' })

    await vi.waitFor(() =>
      expect(messages).toEqual([
        { type: 'steam-sign-in', nonce: 'nonce-2', authError: 'RATE_LIMITED' },
      ]),
    )
    channel.close()
  })

  it('drops a junk auth_error rather than forwarding it', () => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    window.sessionStorage.setItem(STORAGE_KEY, 'nonce-3')
    setSearch('?auth_error=%3Cscript%3E')

    expect(completeSteamSignInPopup()).toEqual({ authError: undefined })
  })
})
