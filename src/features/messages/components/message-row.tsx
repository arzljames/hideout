import { cva } from 'class-variance-authority'
import { Pencil, Trash2 } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import { authorName } from '../lib/author-name'
import { formatMessageDateTime, formatMessageTime } from '../lib/format-time'
import { linkify } from '../lib/linkify'
import type { EditingState } from '../pending-messages-store'
import type { Message } from '../types'
import { MessageActions } from './message-actions'
import { MessageEditor } from './message-editor'

const messageRowVariants = cva(
  'group/message relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
  {
    variants: {
      actionable: {
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
  message: Message
  /** First message of a group: shows the avatar, author and time. */
  isFirst: boolean
  canEdit: boolean
  canDelete: boolean
  /** Roving tabindex: only the active row in the log is a tab stop. */
  isTabStop: boolean
  /** The inline editor's state when this message is being edited. */
  editing: EditingState | undefined
  /** Called when the row (or its toolbar) receives focus, to make it the active row. */
  onFocusRow: (messageId: string) => void
  onEdit: (message: Message) => void
  onDelete: (message: Message) => void
  onSaveEdit: (message: Message, body: string) => void
  onCancelEdit: (message: Message) => void
  className?: string
}

/**
 * One message, as an article in the message log. The log is a single tab stop: arrow keys move
 * between rows (see MessageList); on a message you can edit or delete, ArrowRight enters its
 * action toolbar. Bodies are bidi-isolated and rendered as text (links via `linkify`).
 */
export function MessageRow({
  message,
  isFirst,
  canEdit,
  canDelete,
  isTabStop,
  editing,
  onFocusRow,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  className,
}: MessageRowProps) {
  const time = formatMessageTime(message.createdAt)
  const name = authorName(message)
  const hintId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const actionable = (canEdit || canDelete) && !editing

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (actionable && event.key === 'ArrowRight') {
      event.preventDefault()
      toolbarRef.current?.querySelector('button')?.focus()
    }
  }

  const row = (
    <div
      ref={rowRef}
      role="article"
      aria-label={`${name}, ${time}`}
      aria-describedby={actionable ? hintId : undefined}
      data-message-row=""
      data-message-id={message.id.toLowerCase()}
      tabIndex={isTabStop ? 0 : -1}
      onFocus={() => onFocusRow(message.id)}
      onKeyDown={handleKeyDown}
      className={cn(messageRowVariants({ actionable, first: isFirst }), className)}
    >
      <div className="row-span-2">
        {isFirst && (
          <UserAvatar
            name={name}
            src={message.author?.avatarUrl}
            initials={message.author ? undefined : '?'}
          />
        )}
      </div>

      {isFirst ? (
        <p className="flex min-w-0 items-baseline gap-2">
          <bdi
            className={cn(
              'truncate text-sm font-semibold',
              !message.author && 'text-muted-foreground',
            )}
          >
            {name}
          </bdi>
          <time dateTime={message.createdAt} className="shrink-0 text-xs text-muted-foreground">
            {time}
          </time>
        </p>
      ) : (
        <span className="sr-only">
          <bdi>{name}</bdi>, {time}:
        </span>
      )}

      {editing ? (
        <MessageEditor
          initialText={editing.text ?? message.body}
          initialError={editing.error}
          onSave={(body) => onSaveEdit(message, body)}
          onCancel={() => onCancelEdit(message)}
        />
      ) : (
        <p className="text-sm leading-relaxed">
          <bdi dir="auto" className="wrap-break-word whitespace-pre-wrap">
            {/* Links join the tab order only in the row that holds the log's tab stop. */}
            {linkify(message.body, { tabIndex: isTabStop ? undefined : -1 })}
          </bdi>
          {message.editedAt && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Edited <time dateTime={message.editedAt}>{formatMessageDateTime(message.editedAt)}</time>
              </TooltipContent>
            </Tooltip>
          )}
        </p>
      )}

      {actionable && (
        <>
          <span id={hintId} className="sr-only">
            Press Right Arrow for message actions.
          </span>
          <MessageActions
            ref={toolbarRef}
            onEdit={canEdit ? () => onEdit(message) : undefined}
            onDelete={canDelete ? () => onDelete(message) : undefined}
            onExit={() => rowRef.current?.focus()}
            className="absolute -top-3 right-4 opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100"
          />
        </>
      )}
    </div>
  )

  if (!actionable) return row

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        {canEdit && (
          <ContextMenuItem onSelect={() => onEdit(message)}>
            <Pencil aria-hidden="true" />
            Edit message
          </ContextMenuItem>
        )}
        {canDelete && (
          <ContextMenuItem variant="destructive" onSelect={() => onDelete(message)}>
            <Trash2 aria-hidden="true" />
            Delete message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
