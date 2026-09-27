import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useChannelErrorEffects } from '@/features/channels'
import { useRealtimeTopic } from '@/hooks/use-realtime-topic'
import { api, ApiError, toApiError, withNetworkErrors } from '@/lib/api/client'
import { parseChannelEvent, realtimeTopics } from '@/lib/realtime/events'
import type { TopicStatus } from '@/lib/realtime/topics'
import { addDeletedId, registerDeletedIds } from '../deleted-message-ids'
import {
  getCachedMessage,
  getNewestMessage,
  getNewestMessageId,
  mergeBackfill,
  messageKeys,
  removeMessage,
  resetMessages,
  sameMessageId,
  updateMessageIfCached,
  upsertMessage,
} from '../message-cache'
import { dropPendingEcho } from '../message-sender'
import type { Message, MessagePage } from '../types'

/** A gap longer than this may hide edits and deletes of older messages: reload the history. */
export const BACKFILL_LONG_GAP_MS = 5 * 60_000
/** Backfill pages to follow before giving up and reloading the history instead. */
export const BACKFILL_MAX_PAGES = 5
/** The API's largest page. */
export const BACKFILL_PAGE_SIZE = 100
/** The contract's backfill starts this long before the `after` message. */
const BACKFILL_OVERLAP_MS = 5_000

type BackfillQuery = { after: string; limit: number } | { cursor: string; limit: number }

async function fetchBackfillPage(
  channelId: string,
  query: BackfillQuery,
  signal: AbortSignal,
): Promise<MessagePage> {
  const result = await withNetworkErrors(() =>
    api.GET('/api/channels/{channelId}/messages', {
      params: { path: { channelId }, query },
      signal,
    }),
  )
  if (result.data) return result.data
  throw toApiError(result)
}

/** A live channel session: one per mount and channel. */
interface Session {
  channelId: string
  controller: AbortController
  /** Whether this session has seen its first SUBSCRIBED. */
  joined: boolean
  /** A catch-up is running; `queuedGapMs` is the gap of a rejoin that arrived meanwhile. */
  running: boolean
  queuedGapMs: number | null
  deletedIds: Set<string>
}


/**
 * The backfilled messages worth merging: new ones, and newer edits of cached ones. Skips ids
 * deleted meanwhile (live, or by this tab), cached messages a live update already brought up to
 * date (the backfill's snapshot may predate them), and uncached messages older than the backfill
 * window (an edit to an old message that isn't loaded must not land in the newest page).
 */
function worthMerging(
  queryClient: QueryClient,
  session: Session,
  messages: readonly Message[],
): Message[] {
  const newest = getNewestMessage(queryClient, session.channelId)
  const windowStart = newest ? Date.parse(newest.createdAt) - BACKFILL_OVERLAP_MS : -Infinity
  return messages.filter((message) => {
    if (session.deletedIds.has(message.id.toLowerCase())) return false
    const cached = getCachedMessage(queryClient, session.channelId, message.id)
    if (!cached) return Date.parse(message.createdAt) >= windowStart
    if (!message.editedAt) return false
    return !cached.editedAt || Date.parse(message.editedAt) > Date.parse(cached.editedAt)
  })
}

/**
 * Catch up on what the topic missed during a gap of `gapMs`:
 * - Longer than BACKFILL_LONG_GAP_MS, or nothing cached to backfill from: reload the history.
 * - Otherwise `GET ?after=<newest id>` (oldest first, overlapping by 5 s), following
 *   `nextCursor` (passed alone, as the contract says) for up to BACKFILL_MAX_PAGES pages, then
 *   merge silently (mergeBackfill: deduplicated by id, not announced). If more remain, reload.
 * - 404: the channel or room is gone for us; the channels feature's error path handles it.
 * - Other failures (offline, 429, 5xx): mark the history stale, so it refetches on the next
 *   focus or reconnect.
 */
async function catchUp(
  queryClient: QueryClient,
  session: Session,
  gapMs: number,
  onNotFound: (error: ApiError) => void,
): Promise<void> {
  const { channelId, controller } = session
  if (gapMs > BACKFILL_LONG_GAP_MS) return resetMessages(queryClient, channelId)
  const newest = getNewestMessageId(queryClient, channelId)
  if (!newest) return resetMessages(queryClient, channelId)

  const collected: Message[] = []
  let query: BackfillQuery = { after: newest, limit: BACKFILL_PAGE_SIZE }
  for (let page = 0; page < BACKFILL_MAX_PAGES; page += 1) {
    let result: MessagePage
    try {
      result = await fetchBackfillPage(channelId, query, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 404) {
        onNotFound(error)
        return
      }
      await queryClient.invalidateQueries({
        queryKey: messageKeys.channel(channelId),
        exact: true,
        refetchType: 'none',
      })
      return
    }
    if (controller.signal.aborted) return
    collected.push(...result.data)
    if (!result.nextCursor) {
      const merged = worthMerging(queryClient, session, collected)
      // Our own sends still pending: the backfilled message replaces the pending row.
      for (const message of merged) dropPendingEcho(queryClient, channelId, message)
      mergeBackfill(queryClient, channelId, merged)
      return
    }
    query = { cursor: result.nextCursor, limit: BACKFILL_PAGE_SIZE }
  }
  // Too much missed to page through: reload the visible history instead.
  return resetMessages(queryClient, channelId)
}

/**
 * Live messages for an open text channel, on the private `channel:<channelId>` topic (joined
 * while mounted, left on unmount or when the channel changes):
 * - `message:created` adds the message (dropping this tab's matching pending send first, so our
 *   own echo never shows twice); repeats are ignored (deduplicated by id).
 * - `message:updated` replaces it by id; `message:deleted` removes it.
 * - Invalid payloads, and payloads naming another channel, are ignored.
 * - Catching up (see `catchUp`), one at a time (a rejoin during a catch-up runs it again after):
 *   on a rejoin after an error, for the time the topic was down; on the first join, for the
 *   time since the cached history was fetched (it may come from the cache, up to its stale
 *   time old, and messages sent before the join completed weren't broadcast to us).
 *
 * When the topic can't join, supabase-js keeps retrying and the rejoin catches up; the room
 * banner (useRoomEvents) covers "live updates paused". No banner of its own.
 */
export function useChannelMessages(roomId: string, channelId: string): void {
  const queryClient = useQueryClient()
  const errorEffects = useChannelErrorEffects(roomId)
  const onNotFound = useRef(errorEffects)
  useLayoutEffect(() => {
    onNotFound.current = errorEffects
  })

  const session = useRef<Session | null>(null)
  useEffect(() => {
    const current: Session = {
      channelId,
      controller: new AbortController(),
      joined: false,
      running: false,
      queuedGapMs: null,
      deletedIds: new Set(),
    }
    session.current = current
    // This tab's optimistic deletes (useDeleteMessage) land in deletedIds too.
    const unregister = registerDeletedIds(channelId, current.deletedIds)
    return () => {
      unregister()
      current.controller.abort()
      if (session.current === current) session.current = null
    }
  }, [channelId])

  function requestCatchUp(current: Session, gapMs: number) {
    if (current.running) {
      current.queuedGapMs = Math.max(current.queuedGapMs ?? 0, gapMs)
      return
    }
    current.running = true
    void (async () => {
      let next: number | null = gapMs
      try {
        while (next !== null && !current.controller.signal.aborted) {
          current.queuedGapMs = null
          await catchUp(queryClient, current, next, (error) => void onNotFound.current(error))
          next = current.queuedGapMs
        }
      } finally {
        current.running = false
        current.queuedGapMs = null
      }
    })()
  }

  // A future `typing:<channelId>` topic (typing indicators) belongs next to this one: join it
  // with its own useRealtimeTopic here, so it is also left when the channel closes.
  useRealtimeTopic(realtimeTopics.channel(channelId), {
    onBroadcast: (event, payload) => {
      const parsed = parseChannelEvent(event, payload)
      if (!parsed) return
      switch (parsed.event) {
        case 'message:created': {
          const { message } = parsed.data
          if (!sameMessageId(message.channelId, channelId)) return
          dropPendingEcho(queryClient, channelId, message)
          upsertMessage(queryClient, channelId, message)
          return
        }
        case 'message:updated': {
          const { message } = parsed.data
          if (!sameMessageId(message.channelId, channelId)) return
          // Only a loaded message: an edit to an older one must not appear at the bottom.
          updateMessageIfCached(queryClient, channelId, message)
          return
        }
        case 'message:deleted': {
          if (!sameMessageId(parsed.data.channelId, channelId)) return
          const current = session.current
          if (current && sameMessageId(current.channelId, channelId)) {
            addDeletedId(current.deletedIds, parsed.data.id)
          }
          removeMessage(queryClient, channelId, parsed.data.id)
          return
        }
      }
    },
    onStatus: (status: TopicStatus) => {
      if (status.type !== 'subscribed') return
      const current = session.current
      if (!current || !sameMessageId(current.channelId, channelId)) return
      let gapMs = status.afterError ? status.downForMs : null
      if (!current.joined) {
        current.joined = true
        const state = queryClient.getQueryState(messageKeys.channel(channelId))
        // Not loaded yet: the history being fetched now is about as fresh as the join.
        if (state?.data !== undefined) {
          gapMs = Math.max(gapMs ?? 0, Date.now() - state.dataUpdatedAt)
        }
      }
      if (gapMs !== null) requestCatchUp(current, gapMs)
    },
  })
}
