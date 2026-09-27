import { CircleAlert, LoaderCircle, Pencil, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'
import { linkify } from '../lib/linkify'
import type { PendingMessage } from '../pending-messages-store'

interface PendingMessageRowProps {
  item: PendingMessage
  /** The signed-in user, shown as the author. */
  authorName: string
  avatarUrl?: string | null
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
  /** Put the text back in the composer. */
  onEdit: (tempId: string) => void
  className?: string
}

/**
 * A message this tab is sending: muted while it's on its way; when it failed, the reason and
 * Retry / Edit / Discard (regular tab stops, after the log's single roving stop). The status
 * line is a `role="status"` region so changes are announced.
 */
export function PendingMessageRow({
  item,
  authorName,
  avatarUrl,
  onRetry,
  onDiscard,
  onEdit,
  className,
}: PendingMessageRowProps) {
  const failed = item.status === 'failed'
  const retrying = failed && item.autoRetry

  return (
    <div
      data-pending-message={item.tempId}
      className={cn('mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-0.5', className)}
    >
      <div className="row-span-3">
        <UserAvatar name={authorName} src={avatarUrl} />
      </div>
      <p className="flex min-w-0 items-baseline gap-2">
        <bdi className="truncate text-sm font-semibold">{authorName}</bdi>
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <bdi dir="auto" className="wrap-break-word whitespace-pre-wrap">
          {linkify(item.body)}
        </bdi>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
        <p
          role="status"
          className={cn(
            'flex items-center gap-1.5 text-xs',
            failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {failed ? (
            <>
              <CircleAlert aria-hidden="true" className="size-3.5" />
              <span>
                Couldn't send. {item.error?.message}
                {retrying && ' Retrying automatically.'}
              </span>
            </>
          ) : (
            <>
              <LoaderCircle aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
              <span>Sending…</span>
            </>
          )}
        </p>
        {failed && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={() => onRetry(item.tempId)}>
              <RotateCw aria-hidden="true" />
              Retry
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => onEdit(item.tempId)}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={() => onDiscard(item.tempId)}>
              <X aria-hidden="true" />
              Discard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
