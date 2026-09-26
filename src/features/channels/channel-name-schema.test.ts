import {
  channelNameFormSchema,
  channelNameSchema,
  CHANNEL_NAME_MAX_LENGTH,
  createChannelFormSchema,
} from './channel-name-schema'

function firstError(value: string) {
  const result = channelNameSchema.safeParse(value)
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('channelNameSchema', () => {
  it('accepts a name and returns it trimmed', () => {
    expect(channelNameSchema.parse('  general  ')).toBe('general')
  })

  it(`accepts 1 to ${CHANNEL_NAME_MAX_LENGTH} characters after trimming`, () => {
    expect(channelNameSchema.safeParse('a').success).toBe(true)
    expect(channelNameSchema.safeParse('a'.repeat(CHANNEL_NAME_MAX_LENGTH)).success).toBe(true)
    expect(channelNameSchema.safeParse(`  ${'a'.repeat(CHANNEL_NAME_MAX_LENGTH)}  `).success).toBe(true)
  })

  it('rejects names longer than the limit', () => {
    expect(firstError('a'.repeat(CHANNEL_NAME_MAX_LENGTH + 1))).toBe(
      `At most ${CHANNEL_NAME_MAX_LENGTH} characters`,
    )
  })

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
    ['tabs and newlines', '\t\n '],
  ])('rejects a blank name (%s)', (_label, value) => {
    expect(firstError(value)).toBe('Give the channel a name')
  })

  it.each([
    ['zero-width space', '\u200b'],
    ['zero-width joiner', '\u200d\u200d'],
    ['byte order mark', '\ufeff'],
    ['a control character', '\u0007'],
    ['right-to-left override', '\u202e'],
    ['bidi isolates', '\u2066\u2069'],
  ])('rejects an invisible-only name (%s)', (_label, value) => {
    expect(channelNameSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    ['zero-width space', 'gen\u200beral'],
    ['right-to-left override', 'abc\u202edef'],
    ['a control character', 'gen\u0000eral'],
  ])('rejects a visible name containing %s', (_label, value) => {
    expect(firstError(value)).toBe("Names can't include invisible or control characters")
  })

  it('rejects blank-looking filler characters', () => {
    expect(channelNameSchema.safeParse('ㅤ').success).toBe(false)
    expect(channelNameSchema.safeParse('⠀').success).toBe(false)
  })

  it.each([
    ['a single emoji', '🎮'],
    ['emoji with text', '🔥 hot takes'],
    ['a ZWJ family sequence', '👨\u200d👩\u200d👧'],
    ['a skin tone modifier', '👍🏽 votes'],
    ['a flag', '🇯🇵 japan'],
    ['non-Latin letters', 'ゲーム'],
  ])('accepts %s', (_label, value) => {
    expect(channelNameSchema.safeParse(value).success).toBe(true)
  })
})

describe('channelNameFormSchema', () => {
  it('rejects a name taken by a sibling, ignoring case and surrounding spaces', () => {
    const schema = channelNameFormSchema(['general', 'Clips'])

    const result = schema.safeParse({ name: '  CLIPS ' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("There's already a channel called that.")
    expect(schema.safeParse({ name: 'planning' }).success).toBe(true)
  })
})

describe('createChannelFormSchema', () => {
  it('only checks names taken within the chosen type', () => {
    const schema = createChannelFormSchema({ text: ['general'], voice: ['voice'] })

    expect(schema.safeParse({ type: 'text', name: 'voice' }).success).toBe(true)
    expect(schema.safeParse({ type: 'voice', name: 'general' }).success).toBe(true)
    const taken = schema.safeParse({ type: 'voice', name: 'Voice' })
    expect(taken.success).toBe(false)
    expect(taken.error?.issues[0]?.path).toEqual(['name'])
  })
})

describe('channelNameSchema: invisible default-ignorables', () => {
  const char = (codePoint: number) => String.fromCodePoint(codePoint)
  const INVISIBLE = "Names can't include invisible or control characters"

  it.each([
    ['combining grapheme joiner (U+034F)', `gen${char(0x034f)}eral`],
    ['variation selector-1 (U+FE00)', `general${char(0xfe00)}`],
    ['variation selector-16 (U+FE0F) after a letter', `a${char(0xfe0f)}b`],
  ])('rejects %s', (_label, value) => {
    expect(firstError(value)).toBe(INVISIBLE)
  })

  it.each([
    ['an emoji with its variation selector', `${char(0x2764)}${char(0xfe0f)} lounge`],
    ['a keycap emoji', `${char(0x31)}${char(0xfe0f)}${char(0x20e3)} squad`],
  ])('accepts %s', (_label, value) => {
    expect(channelNameSchema.safeParse(value).success).toBe(true)
  })

  it("so a lookalike of a taken name can't slip past the taken-name check", () => {
    const schema = channelNameFormSchema(['general'])
    expect(schema.safeParse({ name: `general${char(0xfe00)}` }).success).toBe(false)
    expect(schema.safeParse({ name: `gen${char(0x034f)}eral` }).success).toBe(false)
  })
})
