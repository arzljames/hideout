import { z } from 'zod'

/*
 * Voice preferences (device choices, input mode, volume, push-to-talk key), persisted in
 * localStorage. Preferences only: never tokens, never session state.
 */

export type VoiceInputMode = 'voice-activity' | 'push-to-talk'

export interface VoicePrefs {
  inputMode: VoiceInputMode
  /** A MediaDeviceInfo.deviceId, or 'default'. */
  inputDevice: string
  outputDevice: string
  /** 0 to 100; applied as mic gain (100 = unchanged). */
  inputVolume: number
  /** KeyboardEvent.code of the push-to-talk key (layout independent). */
  pttKey: string
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  inputMode: 'voice-activity',
  inputDevice: 'default',
  outputDevice: 'default',
  inputVolume: 100,
  pttKey: 'Backquote',
}

const STORAGE_KEY = 'hideout.voice-prefs'

/**
 * Keys that can't be the push-to-talk key: they press buttons and links (Enter, Space) or move
 * and cancel (Tab, Escape), so holding them to talk would also activate the focused control.
 */
export const RESERVED_PTT_KEYS: ReadonlySet<string> = new Set([
  'Enter',
  'NumpadEnter',
  'Space',
  'Tab',
  'Escape',
])

const prefsSchema = z.object({
  inputMode: z.enum(['voice-activity', 'push-to-talk']).catch(DEFAULT_VOICE_PREFS.inputMode),
  inputDevice: z.string().min(1).max(512).catch(DEFAULT_VOICE_PREFS.inputDevice),
  outputDevice: z.string().min(1).max(512).catch(DEFAULT_VOICE_PREFS.outputDevice),
  inputVolume: z.number().int().min(0).max(100).catch(DEFAULT_VOICE_PREFS.inputVolume),
  pttKey: z
    .string()
    .min(1)
    .max(64)
    .refine((code) => !RESERVED_PTT_KEYS.has(code))
    .catch(DEFAULT_VOICE_PREFS.pttKey),
})

/** Saved prefs, with defaults for anything missing or invalid. Never throws. */
export function loadVoicePrefs(): VoicePrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_VOICE_PREFS
    const parsed = prefsSchema.safeParse({ ...DEFAULT_VOICE_PREFS, ...JSON.parse(raw) })
    return parsed.success ? parsed.data : DEFAULT_VOICE_PREFS
  } catch {
    return DEFAULT_VOICE_PREFS
  }
}

/** Best effort: storage can be full or disabled (private mode). */
export function saveVoicePrefs(prefs: VoicePrefs): void {
  try {
    const { inputMode, inputDevice, outputDevice, inputVolume, pttKey } = prefs
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ inputMode, inputDevice, outputDevice, inputVolume, pttKey }),
    )
  } catch {
    // Ignore: the choice still applies for this session.
  }
}

/** A readable name for a KeyboardEvent.code, e.g. `KeyV` → `V`, `Backquote` → `` ` ``. */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Space: 'Space',
    CapsLock: 'Caps Lock',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    ControlLeft: 'Left Ctrl',
    ControlRight: 'Right Ctrl',
    AltLeft: 'Left Alt',
    AltRight: 'Right Alt',
  }
  if (named[code]) return named[code]
  const match = /^(?:Key|Digit|Numpad)(.+)$/.exec(code)
  return match ? match[1]! : code
}
