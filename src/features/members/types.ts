import type { components } from '@/lib/api/schema.gen'

type Schemas = components['schemas']

// Aliases of the hideout-api contract types; never redeclare these shapes by hand.
export type ChangeRoleBody = Schemas['ChangeRoleBody']
export type TransferOwnershipBody = Schemas['TransferOwnershipBody']
