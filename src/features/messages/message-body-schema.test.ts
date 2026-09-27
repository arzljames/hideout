import {
  countCodePoints,
  hasVisibleCharacter,
  MESSAGE_MAX_LENGTH,
  messageBodyIssue,
  messageBodySchema,
} from './message-body-schema'

// Escapes are built with fromCodePoint/fromCharCode so no invisible character hides in the source.
const cp = (...points: number[]) => String.fromCodePoint(...points)
const OWL = cp(0x1f989)
const COMBINING_ACUTE = cp(0x0301)
const LONE_HIGH = String.fromCharCode(0xd800)
const LONE_LOW = String.fromCharCode(0xdc00)

describe('message body schema', () => {
  it('accepts 1 to 2000 code points and rejects 2001', () => {
    expect(messageBodyIssue('a')).toBeNull()
    expect(messageBodyIssue('a'.repeat(MESSAGE_MAX_LENGTH))).toBeNull()
    expect(messageBodyIssue('a'.repeat(MESSAGE_MAX_LENGTH + 1))).toBe('tooLong')
  })

  it('counts an emoji (a surrogate pair) as one code point', () => {
    expect(countCodePoints(OWL)).toBe(1)
    expect(OWL.repeat(MESSAGE_MAX_LENGTH).length).toBe(2 * MESSAGE_MAX_LENGTH)
    expect(messageBodyIssue(OWL.repeat(MESSAGE_MAX_LENGTH))).toBeNull()
    expect(messageBodyIssue(OWL.repeat(MESSAGE_MAX_LENGTH + 1))).toBe('tooLong')
  })

  it('counts CRLF as one character, as the API stores it as LF', () => {
    expect(countCodePoints('a\r\nb')).toBe(3)
    const body = `x${'\r\n'.repeat(MESSAGE_MAX_LENGTH - 1)}`
    expect(body.length).toBeGreaterThan(MESSAGE_MAX_LENGTH)
    expect(messageBodyIssue(body)).toBeNull()
    expect(messageBodyIssue(`${body}\r\n`)).toBe('tooLong')
  })

  it('does not trim: surrounding spaces are kept and counted', () => {
    expect(messageBodySchema.parse('  hi  ')).toBe('  hi  ')
    expect(messageBodySchema.parse('\n\thi\n')).toBe('\n\thi\n')
    expect(messageBodyIssue(`hi${' '.repeat(MESSAGE_MAX_LENGTH - 1)}`)).toBe('tooLong')
  })

  it.each([
    ['empty', ''],
    ['spaces, tabs and newlines', ' \t\n \r\n'],
    ['zero-width space, joiner and BOM (format characters)', cp(0x200b, 0x200d, 0xfeff)],
    ['bidi controls only', cp(0x202e, 0x2067, 0x2069)],
    ['a lone combining mark', COMBINING_ACUTE],
    ['the braille blank U+2800', cp(0x2800)],
    ['Hangul fillers', cp(0x115f, 0x1160, 0x3164, 0xffa0)],
  ])('rejects a body with nothing visible: %s', (_label, body) => {
    expect(hasVisibleCharacter(body)).toBe(false)
    expect(messageBodyIssue(body)).toBe('blank')
    expect(messageBodySchema.safeParse(body).success).toBe(false)
  })

  it('accepts a combining mark on a base letter', () => {
    expect(messageBodyIssue(`e${COMBINING_ACUTE}`)).toBeNull()
  })

  it('rejects lone surrogates (not well-formed UTF-16)', () => {
    expect(messageBodyIssue(`a${LONE_HIGH}`)).toBe('malformed')
    expect(messageBodyIssue(`${LONE_LOW}a`)).toBe('malformed')
    expect(messageBodyIssue(`a${LONE_HIGH}b`)).toBe('malformed')
    // A proper pair is fine.
    expect(messageBodyIssue(`a${OWL}`)).toBeNull()
  })

  it('accepts bidi controls alongside visible text', () => {
    expect(messageBodyIssue(`${cp(0x202e)}abc${cp(0x202c)}`)).toBeNull()
    expect(messageBodyIssue(`${cp(0x2067)}${cp(0x05e9, 0x05dc, 0x05d5, 0x05dd)}${cp(0x2069)} hi`)).toBeNull()
  })

  it('rejects control characters other than tab and newline, including a lone CR', () => {
    expect(messageBodyIssue('a\tb\nc\r\nd')).toBeNull()
    expect(messageBodyIssue(`a${cp(0x07)}`)).toBe('control')
    expect(messageBodyIssue('a\rb')).toBe('control')
  })
})
