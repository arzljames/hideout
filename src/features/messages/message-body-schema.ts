import { z } from 'zod'

/** MessageBody in the hideout-api contract: at most 2000 Unicode code points. */
export const MESSAGE_MAX_LENGTH = 2000

/** The API stores CRLF as LF, and counts after that. */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

/** Code points as the API counts them (after CRLF to LF), so an emoji counts once. */
export function countCodePoints(value: string): number {
  return Array.from(normalizeNewlines(value)).length
}

/**
 * Characters that don't count as visible text: whitespace, controls (Cc), format characters
 * (Cf: zero-width, bidi controls, ...), combining marks on their own (Mn, Me), the braille
 * blank and the Hangul fillers.
 */
const INVISIBLE = /^[\s\p{Cc}\p{Cf}\p{Mn}\p{Me}\u2800\u115F\u1160\u3164\uFFA0]$/u

/** Controls other than tab and line feed (a lone CR included, once CRLF is normalized). */
const DISALLOWED_CONTROL = /[\p{Cc}]/u
const ALLOWED_CONTROLS = new Set(['\t', '\n'])

/** A lone surrogate (not well-formed UTF-16). No `u` flag, so surrogates match individually. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

/** At least one character that isn't whitespace, invisible or a lone combining mark. */
export function hasVisibleCharacter(value: string): boolean {
  for (const char of value) {
    if (!INVISIBLE.test(char)) return true
  }
  return false
}

function hasDisallowedControl(value: string): boolean {
  for (const char of normalizeNewlines(value)) {
    if (DISALLOWED_CONTROL.test(char) && !ALLOWED_CONTROLS.has(char)) return true
  }
  return false
}

export const MESSAGE_BODY_MESSAGES = {
  blank: 'Type a message first',
  tooLong: `At most ${MESSAGE_MAX_LENGTH} characters`,
  control: "Messages can't include control characters",
  malformed: "This message has a character that can't be sent",
} as const

export type MessageBodyIssue = keyof typeof MESSAGE_BODY_MESSAGES

/**
 * Why `value` isn't a valid MessageBody, or null when it is. Mirrors the contract (the API
 * stays the authority; its 422 message is shown if it disagrees). The body is never trimmed.
 */
export function messageBodyIssue(value: string): MessageBodyIssue | null {
  if (!hasVisibleCharacter(value)) return 'blank'
  if (LONE_SURROGATE.test(value)) return 'malformed'
  if (hasDisallowedControl(value)) return 'control'
  if (countCodePoints(value) > MESSAGE_MAX_LENGTH) return 'tooLong'
  return null
}

/** A message body, sent as typed (not trimmed). */
export const messageBodySchema = z.string().superRefine((value, context) => {
  const issue = messageBodyIssue(value)
  if (issue) context.addIssue({ code: 'custom', message: MESSAGE_BODY_MESSAGES[issue] })
})

/** The composer and the inline editor. */
export const messageFormSchema = z.object({ body: messageBodySchema })

export type MessageFormValues = z.infer<typeof messageFormSchema>
