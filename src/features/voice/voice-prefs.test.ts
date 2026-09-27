import { DEFAULT_VOICE_PREFS, keyLabel, loadVoicePrefs, saveVoicePrefs } from './voice-prefs'

const KEY = 'hideout.voice-prefs'

function store(value: unknown) {
  window.localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

describe('loadVoicePrefs', () => {
  it('defaults to voice activity, system devices, 100% and the ` key', () => {
    expect(loadVoicePrefs()).toEqual({
      inputMode: 'voice-activity',
      inputDevice: 'default',
      outputDevice: 'default',
      inputVolume: 100,
      pttKey: 'Backquote',
    })
  })

  it('round-trips what saveVoicePrefs wrote', () => {
    const prefs = {
      inputMode: 'push-to-talk' as const,
      inputDevice: 'usb-mic',
      outputDevice: 'monitor',
      inputVolume: 35,
      pttKey: 'KeyV',
    }
    saveVoicePrefs(prefs)

    expect(loadVoicePrefs()).toEqual(prefs)
  })

  it('saves preferences only, never session state', () => {
    saveVoicePrefs({
      ...DEFAULT_VOICE_PREFS,
      // Extra fields a caller might pass along (e.g. the whole store).
      ...({ status: 'connected', channelId: 'c1', muted: true } as object),
    })

    expect(Object.keys(JSON.parse(window.localStorage.getItem(KEY)!) as object).sort()).toEqual([
      'inputDevice',
      'inputMode',
      'inputVolume',
      'outputDevice',
      'pttKey',
    ])
  })

  it.each(['{not json', 'null', '"a string"', '42'])('falls back to defaults for %j', (raw) => {
    store(raw)
    expect(loadVoicePrefs()).toEqual(DEFAULT_VOICE_PREFS)
  })

  it.each(['Enter', 'NumpadEnter', 'Space', 'Tab', 'Escape', ''])(
    'a saved push-to-talk key of %j falls back to Backquote, keeping the rest',
    (pttKey) => {
      store({ inputMode: 'push-to-talk', pttKey, inputVolume: 60 })
      expect(loadVoicePrefs()).toMatchObject({
        inputMode: 'push-to-talk',
        pttKey: 'Backquote',
        inputVolume: 60,
      })
    },
  )

  it('replaces each invalid field with its default and keeps the valid ones', () => {
    store({
      inputMode: 'always-on',
      inputDevice: '',
      outputDevice: 'x'.repeat(513),
      inputVolume: 150,
      pttKey: 'KeyT',
    })
    expect(loadVoicePrefs()).toEqual({ ...DEFAULT_VOICE_PREFS, pttKey: 'KeyT' })

    store({ inputVolume: 12.5, inputDevice: 'usb-mic' })
    expect(loadVoicePrefs()).toEqual({ ...DEFAULT_VOICE_PREFS, inputDevice: 'usb-mic' })
  })

  it('never throws when storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    try {
      expect(loadVoicePrefs()).toEqual(DEFAULT_VOICE_PREFS)
      expect(() => saveVoicePrefs(DEFAULT_VOICE_PREFS)).not.toThrow()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

describe('keyLabel', () => {
  it.each([
    ['Backquote', '`'],
    ['KeyV', 'V'],
    ['Digit4', '4'],
    ['Numpad7', '7'],
    ['CapsLock', 'Caps Lock'],
    ['ShiftLeft', 'Left Shift'],
    ['AltRight', 'Right Alt'],
    ['F13', 'F13'],
  ])('%s → %s', (code, label) => {
    expect(keyLabel(code)).toBe(label)
  })
})
