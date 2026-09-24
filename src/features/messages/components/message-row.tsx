import { cva } from 'class-variance-authority'
import { Pencil, Trash2 } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '../lib/format-time'
import { linkify } from '../lib/linkify'
import type { ChatMessage } from '../sample-messages'
import { MessageActions } from './message-actions'

const messageRowVariants = cva(
  'group/message relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
  {
    variants: {
      own: {
        true: 'hover:bg-muted/40 focus-within:bg-muted/40 data-[state=open]:bg-muted/40',
        false: '',
      },
      first: {
        true: 'mt-3',
        false: '',
      },
    },
  },
)

interface MessageRowProps {
  message: ChatMessage
  /** First message of a group: shows the avatar, author and time. */
  isFirst: boolean
  /** Your own message: adds the edit/delete toolbar and context menu. */
  isOwn: boolean
  /** Roving tabindex: only the active row in the log is a tab stop. */
  isTabStop: boolean
  /** Called when the row (or its toolbar) receives focus, to make it the active row. */
  onFocusRow: (messageId: string) => void
  className?: string
}

/**
 * One message, as an article in the message log. The log is a single tab stop: arrow keys move
 * between rows (see MessageList), and on your own message ArrowRight enters its action toolbar.
 */
export function MessageRow({
  message,
  isFirst,
  isOwn,
  isTabStop,
  onFocusRow,
  className,
}: MessageRowProps) {
  const time = formatMessageTime(message.sentAt)
  const hintId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (isOwn && event.key === 'ArrowRight') {
      event.preventDefault()
      toolbarRef.current?.querySelector('button')?.focus()
    }
  }

  const row = (
    <div
      ref={rowRef}
      role="article"
      aria-label={`${message.author.name}, ${time}`}
      aria-describedby={isOwn ? hintId : undefined}
      data-message-row=""
      tabIndex={isTabStop ? 0 : -1}
      onFocus={() => onFocusRow(message.id)}
      onKeyDown={handleKeyDown}
      className={cn(messageRowVariants({ own: isOwn, first: isFirst }), className)}
    >
      <div className="row-span-2">
        {isFirst && <UserAvatar name={message.author.name} tone={message.author.tone} />}
      </div>

      {isFirst ? (
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{message.author.name}</span>
          <time dateTime={message.sentAt} className="text-xs text-muted-foreground">
            {time}
          </time>
        </p>
      ) : (
        <span className="sr-only">
          {message.author.name}, {time}:
        </span>
      )}

      <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
        {/* Links join the tab order only in the row that holds the log's tab stop. */}
        {linkify(message.text, { tabIndex: isTabStop ? undefined : -1 })}
        {message.edited && <span className="ml-1 text-xs text-muted-foreground">(edited)</span>}
      </p>

      {isOwn && (
        <>
          <span id={hintId} className="sr-only">
            Press Right Arrow for message actions.
          </span>
          <MessageActions
            ref={toolbarRef}
            onExit={() => rowRef.current?.focus()}
            className="absolute -top-3 right-4 opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100"
          />
        </>
      )}
    </div>
  )

  if (!isOwn) return row

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {/* TODO(api): edit message inline. */}
        <ContextMenuItem>
          <Pencil aria-hidden="true" />
          Edit message
        </ContextMenuItem>
        {/* TODO(api): confirm with an AlertDialog, then delete via the API. */}
        <ContextMenuItem variant="destructive">
          <Trash2 aria-hidden="true" />
          Delete message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
