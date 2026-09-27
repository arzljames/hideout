import type { QueryClient } from '@tanstack/react-query'
import type { Message, MessagePage, MessagesData } from './types'

// A channel's history lives in one infinite query (see messagesQueryOptions): pages newest
// first, each page newest first. These helpers keep it deduplicated by id (ids are UUIDs and
// compare case-insensitively) and are no-ops while the channel's history isn't cached.

export const messageKeys = {
  all: ['messages'] as const,
  channel: (channelId: string) => ['messages', channelId.toLowerCase()] as const,
}

export function sameMessageId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** Newest first: by createdAt, then id (so equal timestamps keep a stable order). */
function newestFirst(a: Message, b: Message): number {
  const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  if (byTime !== 0) return byTime
  return b.id.toLowerCase().localeCompare(a.id.toLowerCase())
}

function updateMessages(
  queryClient: QueryClient,
  channelId: string,
  update: (data: MessagesData) => MessagesData,
) {
  queryClient.setQueryData<MessagesData>(messageKeys.channel(channelId), (data) =>
    data ? update(data) : data,
  )
}

/**
 * Replace each message that's already cached (in whichever page holds it) and insert the rest
 * into the newest page, keeping that page newest first.
 */
function upsertMany(data: MessagesData, messages: readonly Message[]): MessagesData {
  if (messages.length === 0) return data
  const incoming = new Map<string, Message>()
  for (const message of messages) incoming.set(message.id.toLowerCase(), message)

  let changed = false
  const pages = data.pages.map((page) => {
    let pageChanged = false
    const pageData = page.data.map((message) => {
      const key = message.id.toLowerCase()
      const next = incoming.get(key)
      if (!next) return message
      incoming.delete(key)
      if (next === message) return message
      pageChanged = true
      return next
    })
    if (!pageChanged) return page
    changed = true
    return { ...page, data: pageData }
  })

  if (incoming.size === 0) return changed ? { ...data, pages } : data

  const [first] = pages
  if (!first) {
    return {
      pages: [{ data: [...incoming.values()].sort(newestFirst), nextCursor: null }],
      pageParams: [undefined],
    }
  }
  pages[0] = { ...first, data: [...first.data, ...incoming.values()].sort(newestFirst) }
  return { ...data, pages }
}

/**
 * Add or replace one message (e.g. a sent message, or a live `message:created` /
 * `message:updated`). A new id goes into the newest page; a known id is replaced in place.
 * Idempotent.
 */
export function upsertMessage(queryClient: QueryClient, channelId: string, message: Message) {
  updateMessages(queryClient, channelId, (data) => upsertMany(data, [message]))
}

/**
 * Replace a message only if it's cached (e.g. a live `message:updated`): an edit to an older
 * message that isn't loaded must not be inserted into the newest page. Returns true if replaced.
 */
export function updateMessageIfCached(
  queryClient: QueryClient,
  channelId: string,
  message: Message,
): boolean {
  if (!getCachedMessage(queryClient, channelId, message.id)) return false
  upsertMessage(queryClient, channelId, message)
  return true
}

/** The newest cached message, or undefined when none is cached. */
export function getNewestMessage(queryClient: QueryClient, channelId: string): Message | undefined {
  const id = getNewestMessageId(queryClient, channelId)
  return id ? getCachedMessage(queryClient, channelId, id) : undefined
}

/** Forget one message (deleted). Idempotent. */
export function removeMessage(queryClient: QueryClient, channelId: string, messageId: string) {
  updateMessages(queryClient, channelId, (data) => {
    let changed = false
    const pages = data.pages.map((page) => {
      const kept = page.data.filter((message) => !sameMessageId(message.id, messageId))
      if (kept.length === page.data.length) return page
      changed = true
      return { ...page, data: kept }
    })
    return changed ? { ...data, pages } : data
  })
}

/**
 * Merge a reconnect backfill (`GET ...?after=`, oldest first). Duplicates are deduplicated by
 * id; the pages stay newest first. These messages are not announced to screen readers as new
 * (see `isQuietMessage`).
 */
export function mergeBackfill(
  queryClient: QueryClient,
  channelId: string,
  messagesOldestFirst: readonly Message[],
) {
  for (const message of messagesOldestFirst) markQuiet(message.id)
  updateMessages(queryClient, channelId, (data) => upsertMany(data, messagesOldestFirst))
}

/** The newest cached message's id (for `?after=` backfill), or undefined when none is cached. */
export function getNewestMessageId(queryClient: QueryClient, channelId: string): string | undefined {
  const data = queryClient.getQueryData<MessagesData>(messageKeys.channel(channelId))
  let newest: Message | undefined
  for (const page of data?.pages ?? []) {
    for (const message of page.data) {
      if (!newest || newestFirst(message, newest) < 0) newest = message
    }
  }
  return newest?.id
}

/** Every cached message of a channel, oldest first, deduplicated by id. */
export function flattenMessages(data: { pages: readonly MessagePage[] } | undefined): Message[] {
  if (!data) return []
  const byId = new Map<string, Message>()
  for (const page of data.pages) {
    for (const message of page.data) {
      const key = message.id.toLowerCase()
      if (!byId.has(key)) byId.set(key, message)
    }
  }
  return [...byId.values()].sort((a, b) => newestFirst(b, a))
}

/** One cached message by id. */
export function getCachedMessage(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
): Message | undefined {
  const data = queryClient.getQueryData<MessagesData>(messageKeys.channel(channelId))
  for (const page of data?.pages ?? []) {
    const found = page.data.find((message) => sameMessageId(message.id, messageId))
    if (found) return found
  }
  return undefined
}

/**
 * Reload the visible history (e.g. after a long disconnect, when edits and deletes may have
 * been missed): drop the older pages and refetch the newest one. Resolves when the refetch
 * settles (at once if the history isn't on screen; it's refetched when it next is).
 */
export async function resetMessages(queryClient: QueryClient, channelId: string): Promise<void> {
  const queryKey = messageKeys.channel(channelId)
  updateMessages(queryClient, channelId, (data) => ({
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
  }))
  await queryClient.invalidateQueries({ queryKey, exact: true })
}

// --- Quiet ids -------------------------------------------------------------------------------

/** Most recent backfilled ids; the list skips them when announcing new messages. */
const quietIds = new Set<string>()
const QUIET_LIMIT = 500

function markQuiet(messageId: string) {
  quietIds.add(messageId.toLowerCase())
  if (quietIds.size > QUIET_LIMIT) {
    const oldest = quietIds.values().next()
    if (!oldest.done) quietIds.delete(oldest.value)
  }
}

/** True for messages that arrived through `mergeBackfill` (not announced as new). */
export function isQuietMessage(messageId: string): boolean {
  return quietIds.has(messageId.toLowerCase())
}
