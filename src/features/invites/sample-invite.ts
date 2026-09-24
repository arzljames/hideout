// TODO(api): replace with the invite preview query; use contract types from schema, don't keep these shapes.

import type { ComponentProps } from 'react'
import type { UserAvatar } from '@/components/user-avatar'

type PersonaTone = ComponentProps<typeof UserAvatar>['tone']

/** Presentational shape for the invite card. Will be mapped from the API contract later. */
export interface InvitePreview {
  inviter: {
    name: string
    tone?: PersonaTone
  }
  room: {
    name: string
    emoji: string
    onlineCount: number
    memberCount: number
  }
  /** Channel name without the leading `#`. */
  landingChannel: string
}

export interface InviteViewer {
  name: string
  tone?: PersonaTone
}

export const sampleInvite: InvitePreview = {
  inviter: { name: 'Maya', tone: 'persona-1' },
  room: { name: 'Night Owls', emoji: '🦉', onlineCount: 5, memberCount: 7 },
  landingChannel: 'general',
}

export const sampleViewer: InviteViewer = { name: 'Arzl', tone: 'persona-3' }
