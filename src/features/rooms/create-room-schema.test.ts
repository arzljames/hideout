import { createRoomDefaults, createRoomSchema, ROOM_NAME_MAX_LENGTH } from './create-room-schema'
import { DEFAULT_ROOM_EMOJI } from './room-emojis'

function nameIssues(name: string) {
  const result = createRoomSchema.safeParse({ name, emoji: DEFAULT_ROOM_EMOJI })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('createRoomSchema', () => {
  it('defaults to an empty name and the Owl icon', () => {
    expect(createRoomDefaults).toEqual({ name: '', emoji: '🦉' })
  })

  it('requires a name', () => {
    expect(nameIssues('')).toEqual(['Give your room a name'])
  })

  it('treats a whitespace-only name as missing', () => {
    expect(nameIssues('   ')).toEqual(['Give your room a name'])
  })

  it('accepts a name of exactly 40 characters', () => {
    expect(ROOM_NAME_MAX_LENGTH).toBe(40)
    expect(nameIssues('a'.repeat(40))).toEqual([])
  })

  it('rejects names longer than 40 characters', () => {
    expect(nameIssues('a'.repeat(41))).toEqual(['At most 40 characters'])
  })

  it('trims surrounding whitespace from the name', () => {
    const result = createRoomSchema.parse({ name: '  Night Owls  ', emoji: '🔥' })
    expect(result).toEqual({ name: 'Night Owls', emoji: '🔥' })
  })

  it('rejects an emoji that is not in the picker', () => {
    const result = createRoomSchema.safeParse({ name: 'Raid', emoji: '🍕' })
    expect(result.success).toBe(false)
  })
})
