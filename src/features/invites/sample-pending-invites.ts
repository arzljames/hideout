// TODO(api): replace with the pending-invites query; use contract types from schema, don't keep
// these shapes.

import type { ComponentProps } from 'react'
import type { UserAvatar } from '@/components/user-avatar'

type PersonaTone = ComponentProps<typeof UserAvatar>['tone']

/** An invite waiting for the signed-in user, as the Invites inbox shows it. */
export interface PendingInvite {
  id: string
  room: {
    name: string
    emoji: string
  }
  inviter: {
    name: string
    tone?: PersonaTone
  }
  /** Relative time label, e.g. "2 hours ago". TODO(api): an ISO sentAt, formatted here. */
  sentLabel: string
}

export const samplePendingInvites: PendingInvite[] = [
  {
    id: 'inv-raid',
    room: { name: 'Friday Night Raid', emoji: '🛡️' },
    inviter: { name: 'Theo', tone: 'persona-3' },
    sentLabel: '2 hours ago',
  },
  {
    id: 'inv-coop',
    room: { name: 'Co-op Sundays', emoji: '🍄' },
    inviter: { name: 'Priya', tone: 'persona-2' },
    sentLabel: 'Yesterday',
  },
  {
    id: 'inv-speedrun',
    room: { name: 'Speedrun Lab', emoji: '⏰' },
    inviter: { name: 'Rin', tone: 'persona-1' },
    sentLabel: '3 days ago',
  },
]
