import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { CircleAlert, LoaderCircle, MessagesSquare, RotateCw, WifiOff } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { CenteredState } from '@/components/centered-state'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { meQueryOptions } from '@/features/auth'
import { cn } from '@/lib/utils'
import { messagesQueryOptions, useEditMessage, useMessagePermissions, useSendMessage } from '../api'
import { authorName } from '../lib/author-name'
import { formatDayLabel } from '../lib/format-time'
import { toLogRows, type MessageLogRow } from '../lib/group-messages'
import { flattenMessages, isQuietMessage, sameMessageId } from '../message-cache'
import { isOfflineError, messagesLoadErrorMessage } from '../message-errors'
import {
  startEditing,
  stopEditing,
  useEditingState,
  usePendingMessages,
  type PendingMessage,
} from '../pending-messages-store'
import type { Message } from '../types'
import { DayDivider } from './day-divider'
import { DeleteMessageDialog } from './delete-message-dialog'
import { JumpToLatest } from './jump-to-latest'
import { MessageRow } from './message-row'
import { MessagesSkeleton } from './messages-skeleton'
import { PendingMessageRow } from './pending-message-row'

/** Within this distance of the bottom, new messages keep the view pinned to the newest. */
const STICK_TO_BOTTOM_PX = 80
/** Within this distance of the top, older messages are loaded. */
const LOAD_OLDER_PX = 400
/** More new messages than this at once are announced as a count. */
const ANNOUNCE_EACH_MAX = 3
const ANNOUNCE_BODY_MAX = 200

type VirtualRow =
  | { kind: 'top'; key: 'top' }
  | MessageLogRow
  | { kind: 'pending'; key: string; item: PendingMessage }

function estimateRowSize(row: VirtualRow | undefined): number {
  switch (row?.kind) {
    case 'top':
      return 72
    case 'day':
      return 36
    case 'pending':
      return 88
    case 'message':
      return row.isFirst ? 64 : 28
    default:
      return 40
  }
}

/** Oldest first order (matches flattenMessages). */
function isNewer(a: Message, b: Message): boolean {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (byTime !== 0) return byTime > 0
  return a.id.toLowerCase() > b.id.toLowerCase()
}

function announcementFor(message: Message): string {
  const body = Array.from(message.body)
  const text = body.length > ANNOUNCE_BODY_MAX ? `${body.slice(0, ANNOUNCE_BODY_MAX).join('')}…` : message.body
  return `${authorName(message)}: ${text}`
}

interface Announcement {
  id: number
  text: string
}

interface MessageListProps {
  roomId: string
  roomName: string
  channelId: string
  channelName: string
  className?: string
}

/**
 * A text channel's messages, newest at the bottom, virtualized (@tanstack/react-virtual), with
 * this tab's pending sends after them. Scrolling near the top loads older pages (the first
 * visible message stays in place); near the bottom it follows new messages, otherwise a "Jump
 * to latest" pill counts them.
 *
 * The log is one tab stop (roving tabindex): the newest message holds it at first;
 * ArrowUp/ArrowDown move between messages and Home/End jump to the first/last loaded, and Tab
 * leaves for the pending rows' buttons and the composer.
 *
 * Screen readers: the log itself is `aria-live="off"` (rows mount and unmount as you scroll);
 * a separate polite region announces only messages from others that arrive after the list
 * mounted, newer than anything already shown, and not merged by `mergeBackfill`.
 */
export function MessageList({ roomId, roomName, channelId, channelName, className }: MessageListProps) {
  const query = useInfiniteQuery(messagesQueryOptions(channelId))
  const { data, error, refetch } = query

  if (!data) {
    if (error) {
      const offline = isOfflineError(error)
      return (
        <CenteredState
          tone="destructive"
          icon={offline ? <WifiOff aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          title="Messages didn't load"
          description={messagesLoadErrorMessage(error)}
          actions={
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              <RotateCw aria-hidden="true" />
              Retry
            </Button>
          }
          className={className}
        />
      )
    }
    return <MessagesSkeleton className={className} />
  }

  return (
    <LoadedMessageList
      roomId={roomId}
      roomName={roomName}
      channelId={channelId}
      channelName={channelName}
      messages={flattenMessages(data)}
      hasOlder={query.hasNextPage}
      loadingOlder={query.isFetchingNextPage}
      olderFailed={query.isFetchNextPageError}
      loadOlder={() => void query.fetchNextPage({ cancelRefetch: false })}
      className={className}
    />
  )
}

interface LoadedMessageListProps extends MessageListProps {
  messages: Message[]
  hasOlder: boolean
  loadingOlder: boolean
  olderFailed: boolean
  loadOlder: () => void
}

function LoadedMessageList({
  roomId,
  roomName,
  channelId,
  channelName,
  messages,
  hasOlder,
  loadingOlder,
  olderFailed,
  loadOlder,
  className,
}: LoadedMessageListProps) {
  const me = useQuery(meQueryOptions).data ?? undefined
  const permissions = useMessagePermissions(roomId)
  const allPending = usePendingMessages(channelId)
  // Echoed rows are hidden: the live message stands in for them (see dropPendingEcho).
  const pending = useMemo(() => allPending.filter((item) => !item.echoed), [allPending])
  const editing = useEditingState(channelId)
  const sender = useSendMessage(roomId, channelId)
  const editMessage = useEditMessage(roomId, channelId)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)
  const [focusedId, setFocusedId] = useState<string>()
  const pendingFocusRef = useRef<string | null>(null)
  const [deleting, setDeleting] = useState<{ message: Message; neighbourId?: string; key: number }>()
  const [unseen, setUnseen] = useState(0)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  const rows = useMemo<VirtualRow[]>(
    () => [
      { kind: 'top', key: 'top' },
      ...toLogRows(messages),
      ...pending.map((item) => ({ kind: 'pending' as const, key: item.tempId, item })),
    ],
    [messages, pending],
  )

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((row, index) => {
      if (row.kind === 'message') map.set(row.key, index)
    })
    return map
  }, [rows])

  const activeMessageId =
    focusedId && messages.some((message) => sameMessageId(message.id, focusedId))
      ? focusedId
      : messages.at(-1)?.id
  const activeIndex = activeMessageId ? rowIndexById.get(activeMessageId.toLowerCase()) : undefined
  const editingIndex = editing ? rowIndexById.get(editing.messageId.toLowerCase()) : undefined

  // Keep the row holding the tab stop, and an open editor, mounted even when scrolled away.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = new Set(defaultRangeExtractor(range))
      if (activeIndex !== undefined) indexes.add(activeIndex)
      if (editingIndex !== undefined) indexes.add(editingIndex)
      return [...indexes].sort((a, b) => a - b)
    },
    [activeIndex, editingIndex],
  )

  // We don't use the React Compiler; useVirtualizer's unstable return value is intended.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => estimateRowSize(rows[index]),
    getItemKey: (index) => rows[index]?.key ?? index,
    rangeExtractor,
    overscan: 8,
    // Keep the first visible row in place when older pages are prepended, and follow new
    // rows while within STICK_TO_BOTTOM_PX of the bottom.
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: STICK_TO_BOTTOM_PX,
    paddingStart: 16,
    paddingEnd: 8,
  })

  const atBottom = virtualizer.getDistanceFromEnd() <= STICK_TO_BOTTOM_PX
  const scrollOffset = virtualizer.scrollOffset ?? 0

  // Start at the newest message.
  const initialScrollDone = useRef(false)
  useLayoutEffect(() => {
    if (initialScrollDone.current) return
    initialScrollDone.current = true
    virtualizer.scrollToEnd()
  }, [virtualizer])

  // Load older messages near the top (also when the history doesn't fill the view).
  useEffect(() => {
    if (!initialScrollDone.current || !hasOlder || loadingOlder || olderFailed) return
    if (scrollOffset <= LOAD_OLDER_PX) loadOlder()
  }, [hasOlder, loadOlder, loadingOlder, olderFailed, scrollOffset])

  // Your own sends always jump to the bottom.
  const pendingCount = pending.length
  const previousPendingCount = useRef(pendingCount)
  useEffect(() => {
    if (pendingCount > previousPendingCount.current) virtualizer.scrollToEnd()
    previousPendingCount.current = pendingCount
  }, [pendingCount, virtualizer])

  useEffect(() => {
    if (atBottom) setUnseen(0)
  }, [atBottom])

  // New messages: count them while scrolled up, and announce those from others.
  const newestRef = useRef<Message | undefined>(messages.at(-1))
  const atBottomRef = useRef(atBottom)
  atBottomRef.current = atBottom
  const announcementId = useRef(0)
  useEffect(() => {
    const previous = newestRef.current
    newestRef.current = messages.at(-1) ?? previous
    if (!previous) return
    const arrived = messages.filter((message) => isNewer(message, previous))
    const fromOthers = arrived.filter(
      (message) => !me || !message.author || !sameMessageId(message.author.id, me.id),
    )
    if (fromOthers.length === 0) return
    if (!atBottomRef.current) setUnseen((count) => count + fromOthers.length)
    const toAnnounce = fromOthers.filter((message) => !isQuietMessage(message.id))
    if (toAnnounce.length === 0) return
    const texts =
      toAnnounce.length > ANNOUNCE_EACH_MAX
        ? [`${toAnnounce.length} new messages`]
        : toAnnounce.map(announcementFor)
    setAnnouncements((current) =>
      [...current, ...texts.map((text) => ({ id: ++announcementId.current, text }))].slice(-ANNOUNCE_EACH_MAX),
    )
  }, [me, messages])

  function rowElement(messageId: string) {
    return (
      logRef.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId.toLowerCase())}"]`,
      ) ?? null
    )
  }

  /** Make a message the tab stop, scroll it into view, and focus it once it's rendered. */
  const focusMessage = useCallback(
    (messageId: string) => {
      setFocusedId(messageId)
      pendingFocusRef.current = messageId
      const index = rowIndexById.get(messageId.toLowerCase())
      if (index !== undefined) virtualizer.scrollToIndex(index, { align: 'auto' })
    },
    [rowIndexById, virtualizer],
  )

  useLayoutEffect(() => {
    const messageId = pendingFocusRef.current
    if (!messageId) return
    const element = rowElement(messageId)
    if (!element) return
    pendingFocusRef.current = null
    element.focus()
  })

  // An editor opened elsewhere (e.g. ArrowUp in the composer): bring it into view.
  // Only when the editor opens, not on every list change, so the rows are read from a ref.
  const editingId = editing?.messageId
  const rowIndexByIdRef = useRef(rowIndexById)
  rowIndexByIdRef.current = rowIndexById
  useEffect(() => {
    if (!editingId) return
    const index = rowIndexByIdRef.current.get(editingId.toLowerCase())
    if (index !== undefined) virtualizer.scrollToIndex(index, { align: 'auto' })
  }, [editingId, virtualizer])

  // The editor belongs to this channel's screen; close it when leaving.
  useEffect(() => () => stopEditing(channelId), [channelId])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const targetId = target.getAttribute('data-message-id')
    if (!target.hasAttribute('data-message-row') || !targetId) return
    const index = messages.findIndex((message) => sameMessageId(message.id, targetId))
    if (index === -1) return
    const next = {
      ArrowUp: messages[Math.max(index - 1, 0)],
      ArrowDown: messages[Math.min(index + 1, messages.length - 1)],
      Home: messages[0],
      End: messages.at(-1),
    }[event.key]
    if (!next) return
    event.preventDefault()
    if (hasOlder && (event.key === 'Home' || (event.key === 'ArrowUp' && index === 0))) loadOlder()
    focusMessage(next.id)
  }

  function jumpToLatest() {
    setUnseen(0)
    const newest = messages.at(-1)
    virtualizer.scrollToEnd()
    if (newest) focusMessage(newest.id)
  }

  function handleEdit(message: Message) {
    startEditing(channelId, { messageId: message.id })
  }

  function handleSaveEdit(message: Message, body: string) {
    stopEditing(channelId, message.id)
    editMessage.mutate({ message, body })
    focusMessage(message.id)
  }

  function handleCancelEdit(message: Message) {
    stopEditing(channelId, message.id)
    focusMessage(message.id)
  }

  function handleDelete(message: Message) {
    const index = messages.findIndex((item) => sameMessageId(item.id, message.id))
    const neighbour = messages[index + 1] ?? messages[index - 1]
    setDeleting((current) => ({ message, neighbourId: neighbour?.id, key: (current?.key ?? 0) + 1 }))
  }

  function deleteReturnFocus(): HTMLElement | null {
    if (!deleting) return null
    const own = rowElement(deleting.message.id)
    if (own) return own
    if (deleting.neighbourId) {
      setFocusedId(deleting.neighbourId)
      return rowElement(deleting.neighbourId)
    }
    return null
  }

  const isEmpty = messages.length === 0 && pending.length === 0
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      {isEmpty && (
        <CenteredState
          icon={<MessagesSquare aria-hidden="true" />}
          title="No messages yet"
          description={
            <>
              Only members of <bdi>{roomName}</bdi> can see what's posted in #
              <bdi>{channelName}</bdi>.
            </>
          }
        />
      )}
      {!isEmpty && (
      <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
        <div
          ref={logRef}
          role="log"
          aria-live="off"
          aria-label={`Messages in #${channelName}`}
          onKeyDown={handleKeyDown}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index]
            if (!row) return null
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                {row.kind === 'top' && (
                  <HistoryStart
                    channelName={channelName}
                    hasOlder={hasOlder}
                    loadingOlder={loadingOlder}
                    olderFailed={olderFailed}
                    onRetry={loadOlder}
                  />
                )}
                {row.kind === 'day' && <DayDivider label={formatDayLabel(row.createdAt)} />}
                {row.kind === 'message' && (
                  <MessageRow
                    message={row.message}
                    isFirst={row.isFirst}
                    canEdit={permissions.canEdit(row.message)}
                    canDelete={permissions.canDelete(row.message)}
                    isTabStop={activeMessageId !== undefined && sameMessageId(row.message.id, activeMessageId)}
                    editing={
                      editing && sameMessageId(editing.messageId, row.message.id) ? editing : undefined
                    }
                    onFocusRow={setFocusedId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                  />
                )}
                {row.kind === 'pending' && (
                  <PendingMessageRow
                    item={row.item}
                    authorName={me?.displayName ?? 'You'}
                    avatarUrl={me?.avatarUrl}
                    onRetry={sender.retry}
                    onDiscard={sender.discard}
                    onEdit={sender.restoreToComposer}
                  />
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
      )}

      {unseen > 0 && !atBottom && (
        <JumpToLatest
          count={unseen}
          onJump={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
        />
      )}

      {/* Only new messages from others (see the component doc); never the loaded history. */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {announcements.map((announcement) => (
          <p key={announcement.id}>{announcement.text}</p>
        ))}
      </div>

      {deleting && (
        <DeleteMessageDialog
          key={deleting.key}
          roomId={roomId}
          channelId={channelId}
          message={deleting.message}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(undefined)
          }}
          returnFocus={deleteReturnFocus}
        />
      )}
    </div>
  )
}

interface HistoryStartProps {
  channelName: string
  hasOlder: boolean
  loadingOlder: boolean
  olderFailed: boolean
  onRetry: () => void
}

/** The top of the log: the start of the channel, loading older messages, or a retry. */
function HistoryStart({ channelName, hasOlder, loadingOlder, olderFailed, onRetry }: HistoryStartProps) {
  if (olderFailed) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4 text-sm text-muted-foreground">
        <span>Couldn't load older messages.</span>
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }
  if (loadingOlder || hasOlder) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        <span className={cn(!loadingOlder && 'sr-only')}>Loading older messages…</span>
      </div>
    )
  }
  return (
    <div className="px-4 pt-4 pb-2">
      <p className="font-heading text-lg font-semibold tracking-tight">
        This is the start of #<bdi>{channelName}</bdi>
      </p>
    </div>
  )
}
