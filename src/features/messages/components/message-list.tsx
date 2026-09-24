import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatDayLabel } from '../lib/format-time'
import { groupMessages } from '../lib/group-messages'
import type { ChatMessage } from '../sample-messages'
import { DayDivider } from './day-divider'
import { MessageGroup } from './message-group'

/** Within this distance of the bottom, new messages keep the view pinned to the newest. */
const STICK_TO_BOTTOM_PX = 80

interface MessageListProps {
  channelName: string
  messages: ChatMessage[]
  viewerId: string
  className?: string
}

/**
 * Scrollable message log, newest at the bottom. The log is one tab stop (roving tabindex):
 * the last message holds it at first; ArrowUp/ArrowDown move between messages and Home/End
 * jump to the first/last, and Tab leaves for the composer.
 * TODO(perf): virtualize once a channel can hold more than ~200 messages.
 */
export function MessageList({ channelName, messages, viewerId, className }: MessageListProps) {
  const logRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const [focusedId, setFocusedId] = useState<string>()
  const days = groupMessages(messages)
  // Fall back to the newest message if nothing was focused yet (or it was removed).
  const activeMessageId =
    focusedId && messages.some((message) => message.id === focusedId)
      ? focusedId
      : messages.at(-1)?.id

  function viewport() {
    return logRef.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
  }

  // Track whether the reader is at (or near) the bottom, so new messages don't yank them
  // down while they're reading history.
  useEffect(() => {
    const element = viewport()
    if (!element) return
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      nearBottomRef.current = distance <= STICK_TO_BOTTOM_PX
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  // Layout effect so there's no flash of the old position.
  useLayoutEffect(() => {
    const element = viewport()
    if (element && nearBottomRef.current) element.scrollTop = element.scrollHeight
  }, [messages])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (!target.hasAttribute('data-message-row')) return
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-message-row]'),
    )
    const index = rows.indexOf(target)
    const next = {
      ArrowUp: rows[Math.max(index - 1, 0)],
      ArrowDown: rows[Math.min(index + 1, rows.length - 1)],
      Home: rows[0],
      End: rows.at(-1),
    }[event.key]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
  }

  return (
    <ScrollArea className={cn('min-h-0 flex-1', className)}>
      {/* Arrow-key handling for the roving tab stop; the rows themselves are the focusables. */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={`Messages in #${channelName}`}
        onKeyDown={handleKeyDown}
        className="flex flex-col pt-4 pb-2"
      >
        {days.map((day) => (
          <Fragment key={day.key}>
            <DayDivider label={formatDayLabel(day.sentAt)} />
            {day.groups.map((group) => (
              <MessageGroup
                key={group.id}
                group={group}
                viewerId={viewerId}
                activeMessageId={activeMessageId}
                onFocusMessage={setFocusedId}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </ScrollArea>
  )
}
