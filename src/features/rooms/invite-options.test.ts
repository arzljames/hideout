import {
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  describeInviteLink,
  isInviteExpiry,
  isInviteMaxUses,
} from './invite-options'

const REVOKE = 'You can revoke it any time in Room settings.'

describe('describeInviteLink', () => {
  it('describes the default (1 hour, 1 use) with a singular "use"', () => {
    expect(describeInviteLink('Night Owls', DEFAULT_EXPIRY, DEFAULT_MAX_USES)).toBe(
      `Anyone with this link can join Night Owls until it expires or reaches 1 use. ${REVOKE}`,
    )
  })

  it('pluralises "uses" for more than one', () => {
    expect(describeInviteLink('Night Owls', '1d', '5')).toBe(
      `Anyone with this link can join Night Owls until it expires or reaches 5 uses. ${REVOKE}`,
    )
  })

  it('drops the expiry for Never', () => {
    expect(describeInviteLink('Night Owls', 'never', '10')).toBe(
      `Anyone with this link can join Night Owls until it reaches 10 uses. ${REVOKE}`,
    )
    expect(describeInviteLink('Night Owls', 'never', '1')).toBe(
      `Anyone with this link can join Night Owls until it reaches 1 use. ${REVOKE}`,
    )
  })

  it('drops the use limit for No limit', () => {
    expect(describeInviteLink('Night Owls', '7d', 'unlimited')).toBe(
      `Anyone with this link can join Night Owls until it expires. ${REVOKE}`,
    )
  })

  it('says it never expires and has no limit for Never + No limit', () => {
    expect(describeInviteLink('Night Owls', 'never', 'unlimited')).toBe(
      `Anyone with this link can join Night Owls. It never expires and has no use limit. ${REVOKE}`,
    )
  })

  it('uses the room name it is given', () => {
    expect(describeInviteLink('Raid Night', '1h', '1')).toMatch(/^Anyone with this link can join Raid Night /)
  })
})

describe('invite option guards', () => {
  it('accepts known values and rejects others', () => {
    expect(isInviteExpiry('30m')).toBe(true)
    expect(isInviteExpiry('never')).toBe(true)
    expect(isInviteExpiry('2h')).toBe(false)
    expect(isInviteExpiry('')).toBe(false)
    expect(isInviteMaxUses('unlimited')).toBe(true)
    expect(isInviteMaxUses('100')).toBe(true)
    expect(isInviteMaxUses('0')).toBe(false)
    expect(isInviteMaxUses('')).toBe(false)
  })
})
