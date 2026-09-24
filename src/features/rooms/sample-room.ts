// TODO(api): replace with roomsQueryOptions / roomQueryOptions; use contract types from schema,
// don't keep these shapes.

import type { ComponentProps } from 'react'
import type { UserAvatar } from '@/components/user-avatar'

type PersonaTone = ComponentProps<typeof UserAvatar>['tone']

/** Presentational member shape for the channel panel, member list and voice tiles. */
export interface RoomMember {
  id: string
  name: string
  tone?: PersonaTone
  presence: 'online' | 'offline'
  role?: 'owner' | 'admin'
  /** e.g. "Playing Elden Ring". */
  activity?: string
  /** The signed-in user. */
  isViewer?: boolean
  /** ISO 8601 date they joined the room. */
  joinedAt: string
}

export interface TextChannel {
  id: string
  kind: 'text'
  name: string
  topic?: string
  unread?: boolean
}

export interface VoiceParticipant {
  memberId: string
  muted?: boolean
  deafened?: boolean
  speaking?: boolean
}

export interface VoiceChannel {
  id: string
  kind: 'voice'
  name: string
  participants: VoiceParticipant[]
}

export type Channel = TextChannel | VoiceChannel

export type RoomRole = 'owner' | 'admin' | 'member'


export interface Room {
  id: string
  name: string
  emoji: string
  defaultChannelId: string
  channels: Channel[]
  members: RoomMember[]
}

const nightOwls: Room = {
  id: 'night-owls',
  name: 'Night Owls',
  emoji: '🦉',
  defaultChannelId: 'general',
  channels: [
    { id: 'general', kind: 'text', name: 'general', topic: 'Plans, clips and whatever else' },
    { id: 'clips', kind: 'text', name: 'clips', unread: true },
    { id: 'planning', kind: 'text', name: 'planning' },
    {
      id: 'voice',
      kind: 'voice',
      name: 'voice',
      participants: [
        { memberId: 'maya', speaking: true },
        { memberId: 'jun', muted: true },
        { memberId: 'alex' },
        { memberId: 'priya', deafened: true, muted: true },
        { memberId: 'arzl' },
      ],
    },
    { id: 'late-night', kind: 'voice', name: 'late night', participants: [] },
  ],
  members: [
    { id: 'arzl', name: 'Arzl', tone: 'persona-3', presence: 'online', role: 'owner', isViewer: true, joinedAt: '2026-03-02' },
    {
      id: 'maya',
      name: 'Maya',
      tone: 'persona-1',
      presence: 'online',
      role: 'admin',
      activity: 'Playing Elden Ring',
      joinedAt: '2026-03-02',
    },
    {
      id: 'jun',
      name: 'Jun',
      tone: 'persona-2',
      presence: 'online',
      activity: 'Playing Deep Rock Galactic',
      joinedAt: '2026-05-14',
    },
    { id: 'alex', name: 'Alex', tone: 'persona-1', presence: 'online', joinedAt: '2026-06-20' },
    { id: 'priya', name: 'Priya', tone: 'persona-2', presence: 'online', joinedAt: '2026-08-03' },
    { id: 'theo', name: 'Theo', tone: 'persona-3', presence: 'offline', joinedAt: '2026-09-01' },
    { id: 'sam', name: 'Sam', presence: 'offline', joinedAt: '2026-09-18' },
  ],
}

const viewerMember = (role?: RoomMember['role']): RoomMember => ({
  id: 'arzl',
  name: 'Arzl',
  tone: 'persona-3',
  presence: 'online',
  isViewer: true,
  role,
  joinedAt: '2026-07-11',
})

export const sampleRooms: Room[] = [
  nightOwls,
  {
    id: 'raid-night',
    name: 'Raid Night',
    emoji: '⚔️',
    defaultChannelId: 'lobby',
    channels: [
      { id: 'lobby', kind: 'text', name: 'lobby' },
      { id: 'strats', kind: 'text', name: 'strats' },
      { id: 'raid', kind: 'voice', name: 'raid', participants: [] },
    ],
    members: [
      {
        id: 'theo',
        name: 'Theo',
        tone: 'persona-3',
        presence: 'offline',
        role: 'owner',
        joinedAt: '2026-04-09',
      },
      viewerMember('admin'),
    ],
  },
  {
    id: 'deep-rock',
    name: 'Rock and Stone',
    emoji: '⛏️',
    defaultChannelId: 'general',
    channels: [
      { id: 'general', kind: 'text', name: 'general' },
      { id: 'mission-control', kind: 'voice', name: 'mission control', participants: [] },
    ],
    members: [viewerMember()],
  },
  {
    id: 'pit-lane',
    name: 'Pit Lane',
    emoji: '🏎️',
    defaultChannelId: 'paddock',
    channels: [
      { id: 'paddock', kind: 'text', name: 'paddock' },
      { id: 'grid', kind: 'voice', name: 'grid', participants: [] },
    ],
    members: [viewerMember()],
  },
]

export function getSampleRoom(roomId: string): Room | undefined {
  return sampleRooms.find((room) => room.id === roomId)
}

export function getRoomChannel(room: Room, channelId: string): Channel | undefined {
  return room.channels.find((channel) => channel.id === channelId)
}

/**
 * The signed-in user's role, derived from their own member entry (plain member when it has no
 * role), so there's one source of truth. TODO(api): read it from the room payload's viewer.
 */
export function getViewerRole(room: Room): RoomRole {
  return room.members.find((member) => member.isViewer)?.role ?? 'member'
}

export function getRoomMember(room: Room, memberId: string): RoomMember | undefined {
  return room.members.find((member) => member.id === memberId)
}
