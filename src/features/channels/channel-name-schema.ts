import { z } from 'zod'
import type { ChannelType } from '@/features/rooms'

/** ChannelName in the hideout-api contract: 1–32 UTF-16 code units after trimming and NFC. */
export const CHANNEL_NAME_MAX_LENGTH = 32

/**
 * RGI emoji sequences, which may contain characters that are rejected elsewhere (U+200D zero
 * width joiner, tag characters in subdivision flags). The `v` flag isn't in our TS target
 * (ES2023), so it's built at runtime, with a looser fallback for engines without it.
 */
const EMOJI_SEQUENCE = (() => {
  try {
    return new RegExp('\\p{RGI_Emoji}', 'gv')
  } catch {
    return /\p{Extended_Pictographic}(?:\uFE0F|\p{EMod})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{EMod})?)*|\p{RI}{2}/gu
  }
})()

/**
 * Outside emoji: control (Cc) and format (Cf: zero-width, bidi controls, soft hyphen, U+FEFF,
 * tags) characters, line/paragraph separators, blank-looking fillers (Hangul fillers,
 * halfwidth Hangul filler, braille blank), and the invisible default-ignorables U+034F
 * (combining grapheme joiner) and U+FE00–U+FE0F (variation selectors), which could otherwise
 * make a lookalike of a taken name.
 */
const DISALLOWED = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u115F\u1160\u3164\uFFA0\u2800]|\u034F|[\uFE00-\uFE0F]/u

/** At least one visible letter, number, symbol or punctuation mark. */
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u

/** The name the API stores: trimmed, then NFC-normalized. */
export function normalizeChannelName(value: string): string {
  return value.trim().normalize('NFC')
}

/** Case-insensitive key for "a channel of this type already has this name". */
export function channelNameKey(value: string): string {
  return normalizeChannelName(value).toLowerCase()
}

function withoutEmoji(value: string): string {
  return value.replace(EMOJI_SEQUENCE, '')
}

/**
 * Channel name rules, mirroring ChannelName (the API stays the authority; its 422 message is
 * shown on the field if it disagrees). The room name schema's rules are a subset of these, so
 * nothing is shared beyond the trim-then-length shape.
 */
export const channelNameSchema = z
  .string()
  .overwrite(normalizeChannelName)
  .min(1, 'Give the channel a name')
  .max(CHANNEL_NAME_MAX_LENGTH, `At most ${CHANNEL_NAME_MAX_LENGTH} characters`)
  .refine((value) => !DISALLOWED.test(withoutEmoji(value)), {
    message: "Names can't include invisible or control characters",
    abort: true,
  })
  .refine((value) => VISIBLE.test(value.replace(DISALLOWED, '')), {
    message: 'Use at least one letter, number or symbol',
  })

export const TAKEN_CHANNEL_NAME_MESSAGE = "There's already a channel called that."

/**
 * The create/rename form. `takenNames` are the room's other channels of the same type; a match
 * (ignoring case) fails early, before the API's 409 CHANNEL_NAME_TAKEN.
 */
export function channelNameFormSchema(takenNames: readonly string[]) {
  const taken = new Set(takenNames.map(channelNameKey))
  return z.object({
    name: channelNameSchema.refine((value) => !taken.has(channelNameKey(value)), {
      message: TAKEN_CHANNEL_NAME_MESSAGE,
    }),
  })
}

export type ChannelNameValues = z.infer<ReturnType<typeof channelNameFormSchema>>

/** Every ChannelType in the contract, exactly once (a new contract type fails to compile here). */
const CHANNEL_TYPES = { text: 'text', voice: 'voice' } as const satisfies { [K in ChannelType]: K }

export const channelTypeSchema = z.enum(CHANNEL_TYPES)

/** The create form: type and name, with the name checked against that type's channels. */
export function createChannelFormSchema(takenNames: Record<ChannelType, readonly string[]>) {
  const taken = {
    text: new Set(takenNames.text.map(channelNameKey)),
    voice: new Set(takenNames.voice.map(channelNameKey)),
  }
  return z
    .object({ type: channelTypeSchema, name: channelNameSchema })
    .superRefine((values, context) => {
      if (taken[values.type].has(channelNameKey(values.name))) {
        context.addIssue({ code: 'custom', path: ['name'], message: TAKEN_CHANNEL_NAME_MESSAGE })
      }
    })
}

export type CreateChannelValues = z.infer<ReturnType<typeof createChannelFormSchema>>
