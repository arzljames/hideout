import type { InviteExpiresIn, InviteMaxUses as ContractMaxUses } from './types'

// Values match CreateInviteBody (link) in the hideout-api contract; `satisfies` keeps them honest.
export const EXPIRY_OPTIONS = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
] as const satisfies readonly { value: InviteExpiresIn; label: string }[]

export const MAX_USES_OPTIONS = [
  { value: '1', label: '1' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'unlimited', label: 'No limit' },
] as const satisfies readonly { value: `${ContractMaxUses}` | 'unlimited'; label: string }[]

export type InviteExpiry = (typeof EXPIRY_OPTIONS)[number]['value']
export type InviteMaxUses = (typeof MAX_USES_OPTIONS)[number]['value']

// The API's defaults: 7 days, unlimited uses.
export const DEFAULT_EXPIRY: InviteExpiry = '7d'
export const DEFAULT_MAX_USES: InviteMaxUses = 'unlimited'

const MAX_USES_VALUES: Record<Exclude<InviteMaxUses, 'unlimited'>, ContractMaxUses> = {
  '1': 1,
  '5': 5,
  '10': 10,
  '25': 25,
  '50': 50,
  '100': 100,
}

/** The request's `maxUses` for a Max uses choice (null = unlimited). */
export function maxUsesForRequest(value: InviteMaxUses): ContractMaxUses | null {
  return value === 'unlimited' ? null : MAX_USES_VALUES[value]
}

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
