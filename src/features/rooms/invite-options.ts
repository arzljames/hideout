// TODO(api): align option values with the create-invite request in the hideout-api contract.

export const EXPIRY_OPTIONS = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
] as const

export const MAX_USES_OPTIONS = [
  { value: '1', label: '1' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'unlimited', label: 'No limit' },
] as const

export type InviteExpiry = (typeof EXPIRY_OPTIONS)[number]['value']
export type InviteMaxUses = (typeof MAX_USES_OPTIONS)[number]['value']

export const DEFAULT_EXPIRY: InviteExpiry = '1h'
export const DEFAULT_MAX_USES: InviteMaxUses = '1'

export function isInviteExpiry(value: string): value is InviteExpiry {
  return EXPIRY_OPTIONS.some((option) => option.value === value)
}

export function isInviteMaxUses(value: string): value is InviteMaxUses {
  return MAX_USES_OPTIONS.some((option) => option.value === value)
}

/** Helper text for the invite link, e.g. "…until it expires or reaches 1 use." */
export function describeInviteLink(
  roomName: string,
  expiry: InviteExpiry,
  maxUses: InviteMaxUses,
): string {
  const expires = expiry !== 'never'
  const limited = maxUses !== 'unlimited'
  const uses = limited ? `${maxUses} ${maxUses === '1' ? 'use' : 'uses'}` : ''

  let limit: string
  if (expires && limited) limit = ` until it expires or reaches ${uses}`
  else if (expires) limit = ' until it expires'
  else if (limited) limit = ` until it reaches ${uses}`
  else limit = '. It never expires and has no use limit'

  return `Anyone with this link can join ${roomName}${limit}. You can revoke it any time in Room settings.`
}
