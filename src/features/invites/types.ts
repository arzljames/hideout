import type { components } from '@/lib/api/schema.gen'

type Schemas = components['schemas']

// Aliases of the hideout-api contract types; never redeclare these shapes by hand.
export type Invite = Schemas['Invite']
export type InvitePage = Schemas['InvitePage']
export type InvitePreview = Schemas['InvitePreview']
export type InboxInvite = Schemas['InboxInvite']
export type CreateInviteBody = Schemas['CreateInviteBody']
export type CreatedInvite = Schemas['CreatedInvite']
export type InviteExpiresIn = Schemas['InviteExpiresIn']
export type InviteMaxUses = Schemas['InviteMaxUses']
export type RedeemInviteResult = Schemas['RedeemInviteResult']
export type AcceptInviteResult = Schemas['AcceptInviteResult']
