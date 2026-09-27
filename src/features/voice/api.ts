import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api, toApiError, withNetworkErrors } from '@/lib/api/client'
import { retryTransient } from '@/lib/api/retry'
import type { components } from '@/lib/api/schema.gen'

export type VoiceToken = components['schemas']['VoiceToken']
export type VoiceParticipantList = components['schemas']['VoiceParticipantList']
export type VoiceChannelParticipants = components['schemas']['VoiceChannelParticipants']
type ProfileSummary = components['schemas']['ProfileSummary']

export const voiceKeys = {
  /** Lowercased like roomKeys.detail, so ids from URLs and events find the same entry. */
  participants: (roomId: string) => ['voice', 'participants', roomId.toLowerCase()] as const,
}

function sameId(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * A LiveKit join token for a voice channel. Valid for 60 s: call it right before
 * `room.connect`, never ahead of time, and never cache it (the response is `no-store`).
 */
export async function fetchVoiceToken(channelId: string): Promise<VoiceToken> {
  // No body; the client middleware adds the JSON Content-Type the CSRF check needs.
  const result = await withNetworkErrors(() =>
    api.POST('/api/channels/{channelId}/voice/token', { params: { path: { channelId } } }),
  )
  if (result.data) return result.data
  throw toApiError(result)
}

/** Who is in each voice channel of a room (every live voice channel, empty ones included). */
export function voiceParticipantsQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: voiceKeys.participants(roomId),
    queryFn: async ({ signal }): Promise<VoiceParticipantList> => {
      const result = await withNetworkErrors(() =>
        api.GET('/api/rooms/{roomId}/voice/participants', {
          params: { path: { roomId } },
          signal,
        }),
      )
      if (result.data) return result.data
      throw toApiError(result)
    },
    retry: retryTransient,
  })
}

/**
 * `voice:participants`: the full list for one channel, so replace it (don't merge). The caller
 * checks the channel is one of the room's voice channels; one missing from the cached list (e.g.
 * created since the last fetch) is added. Does nothing until the room's list has loaded.
 */
export function replaceChannelParticipants(
  queryClient: QueryClient,
  roomId: string,
  channelId: string,
  participants: ProfileSummary[],
): void {
  queryClient.setQueryData<VoiceParticipantList>(voiceKeys.participants(roomId), (old) => {
    if (!old) return old
    const known = old.data.some((entry) => sameId(entry.channelId, channelId))
    return {
      ...old,
      data: known
        ? old.data.map((entry) =>
            sameId(entry.channelId, channelId) ? { ...entry, participants } : entry,
          )
        : [...old.data, { channelId, participants }],
    }
  })
}

/**
 * Loads the room's voice participants each time a room is opened. It doesn't subscribe (the
 * caller never re-renders for it); readers use `useVoiceChannelParticipants`. A failure leaves
 * the lists empty until the next open or Realtime rejoin.
 */
export function useRoomVoiceParticipants(roomId: string): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient
      .fetchQuery({ ...voiceParticipantsQueryOptions(roomId), staleTime: 0 })
      .catch(() => {})
  }, [queryClient, roomId])
}

const NO_PARTICIPANTS: ProfileSummary[] = []

/** One voice channel's participants from the cache (loaded by useRoomVoiceParticipants). */
export function useVoiceChannelParticipants(roomId: string, channelId: string): ProfileSummary[] {
  const { data } = useQuery({
    ...voiceParticipantsQueryOptions(roomId),
    enabled: false,
    select: (list) =>
      list.data.find((entry) => sameId(entry.channelId, channelId))?.participants,
  })
  return data ?? NO_PARTICIPANTS
}
