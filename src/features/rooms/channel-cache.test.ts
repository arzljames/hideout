import { QueryClient } from '@tanstack/react-query'
import { channelOf, nightOwls } from '@/test/fixtures/rooms'
import { applyChannelOrder, removeChannel, upsertChannel } from './channel-cache'
import { roomKeys } from './room-cache'
import type { Channel, RoomDetail } from './types'

const ROOM_ID = nightOwls.room.id
const general = channelOf(nightOwls, 'general')
const clips = channelOf(nightOwls, 'clips')
const planning = channelOf(nightOwls, 'planning')
const voice = channelOf(nightOwls, 'voice')
const lateNight = channelOf(nightOwls, 'late night')

function cachedRoom(detail: RoomDetail = nightOwls) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(roomKeys.detail(detail.room.id), detail)
  const read = () => queryClient.getQueryData<RoomDetail>(roomKeys.detail(detail.room.id))
  const names = () => read()?.channels.map((channel) => `${channel.type}:${channel.name}`)
  return { queryClient, read, names }
}

function newChannel(overrides: Partial<Channel>): Channel {
  return {
    id: 'c0000000-0000-4000-8000-000000009999',
    roomId: ROOM_ID,
    type: 'text',
    name: 'memes',
    position: 3,
    ...overrides,
  }
}

describe('channel cache helpers', () => {
  describe('upsertChannel', () => {
    it('inserts a new channel in text-then-voice, position order', () => {
      const { queryClient, names } = cachedRoom()

      upsertChannel(queryClient, ROOM_ID, newChannel({ type: 'voice', name: 'afk', position: 2 }))
      upsertChannel(queryClient, ROOM_ID, newChannel({ id: 'c0000000-0000-4000-8000-000000009998', position: 3 }))

      expect(names()).toEqual([
        'text:general',
        'text:clips',
        'text:planning',
        'text:memes',
        'voice:voice',
        'voice:late night',
        'voice:afk',
      ])
    })

    it('replaces an existing channel in place, matching its id case-insensitively', () => {
      const { queryClient, read } = cachedRoom()

      upsertChannel(queryClient, ROOM_ID, { ...clips, id: clips.id.toUpperCase(), name: 'highlights' })

      const channels = read()?.channels ?? []
      expect(channels.map((channel) => channel.name)).toEqual([
        'general',
        'highlights',
        'planning',
        'voice',
        'late night',
      ])
    })

    it('makes a new lowest-position text channel the default channel', () => {
      const { queryClient, read } = cachedRoom()
      const first = newChannel({ position: -1 })

      upsertChannel(queryClient, ROOM_ID, first)

      expect(read()?.defaultChannelId).toBe(first.id)
    })

    it('finds the room by an upper-case room id', () => {
      const { queryClient, read } = cachedRoom()

      upsertChannel(queryClient, ROOM_ID.toUpperCase(), newChannel({}))

      expect(read()?.channels).toHaveLength(6)
    })

    it('does nothing when the room is not cached', () => {
      const queryClient = new QueryClient()

      upsertChannel(queryClient, ROOM_ID, newChannel({}))

      expect(queryClient.getQueryData(roomKeys.detail(ROOM_ID))).toBeUndefined()
    })
  })

  describe('removeChannel', () => {
    it('removes the channel and returns it', () => {
      const { queryClient, names } = cachedRoom()

      const removed = removeChannel(queryClient, ROOM_ID, lateNight.id.toUpperCase())

      expect(removed).toEqual(lateNight)
      expect(names()).toEqual(['text:general', 'text:clips', 'text:planning', 'voice:voice'])
    })

    it('moves the default channel to the next lowest text channel when the default is removed', () => {
      const { queryClient, read } = cachedRoom()

      removeChannel(queryClient, ROOM_ID, general.id)

      expect(read()?.defaultChannelId).toBe(clips.id)
    })

    it('clears the default channel when no text channel is left', () => {
      const { queryClient, read } = cachedRoom({
        ...nightOwls,
        channels: [general, voice],
      })

      removeChannel(queryClient, ROOM_ID, general.id)

      expect(read()?.defaultChannelId).toBeNull()
    })

    it('returns undefined and leaves the cache alone for an unknown channel', () => {
      const { queryClient, read } = cachedRoom()
      const before = read()

      expect(removeChannel(queryClient, ROOM_ID, 'c0000000-0000-4000-8000-000000009999')).toBeUndefined()
      expect(read()).toBe(before)
    })

    it('does nothing when the room is not cached', () => {
      const queryClient = new QueryClient()

      expect(removeChannel(queryClient, ROOM_ID, general.id)).toBeUndefined()
      expect(queryClient.getQueryData(roomKeys.detail(ROOM_ID))).toBeUndefined()
    })
  })

  describe('applyChannelOrder', () => {
    it('reorders one type, renumbers positions and leaves the other type alone', () => {
      const { queryClient, read } = cachedRoom()

      applyChannelOrder(queryClient, ROOM_ID, 'text', [planning.id, general.id.toUpperCase(), clips.id])

      const channels = read()?.channels ?? []
      expect(channels.map((channel) => [channel.name, channel.position])).toEqual([
        ['planning', 0],
        ['general', 1],
        ['clips', 2],
        ['voice', 0],
        ['late night', 1],
      ])
      expect(read()?.defaultChannelId).toBe(planning.id)
    })

    it('keeps voice channels after text channels when voice is reordered', () => {
      const { queryClient, names, read } = cachedRoom()

      applyChannelOrder(queryClient, ROOM_ID, 'voice', [lateNight.id, voice.id])

      expect(names()).toEqual([
        'text:general',
        'text:clips',
        'text:planning',
        'voice:late night',
        'voice:voice',
      ])
      expect(read()?.defaultChannelId).toBe(general.id)
    })

    it('ignores unknown ids and keeps unlisted channels after the listed ones', () => {
      const { queryClient, names } = cachedRoom()

      applyChannelOrder(queryClient, ROOM_ID, 'text', [
        'c0000000-0000-4000-8000-000000009999',
        planning.id,
      ])

      expect(names()?.slice(0, 3)).toEqual(['text:planning', 'text:general', 'text:clips'])
    })

    it('does nothing when the room is not cached', () => {
      const queryClient = new QueryClient()

      applyChannelOrder(queryClient, ROOM_ID, 'text', [planning.id, general.id, clips.id])

      expect(queryClient.getQueryData(roomKeys.detail(ROOM_ID))).toBeUndefined()
    })
  })
})
