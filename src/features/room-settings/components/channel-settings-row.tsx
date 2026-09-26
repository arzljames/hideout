import { ArrowDown, ArrowUp, GripVertical, Hash, Pencil, Trash2, Volume2 } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { sortableRowVariants, type SortableChannelItem } from '@/features/channels'
import type { Channel } from '@/features/rooms'
import { cn } from '@/lib/utils'

interface ChannelSettingsRowProps {
  channel: Channel
  item: SortableChannelItem
  className?: string
}

/** A channel in Room settings: drag handle, name, Move up/down, Rename and Delete. */
export function ChannelSettingsRow({ channel, item, className }: ChannelSettingsRowProps) {
  const Icon = channel.type === 'text' ? Hash : Volume2
  const { setRowElement, style, isDragging, handleProps, moveUp, moveDown, rename, remove } = item
  const upRef = useRef<HTMLButtonElement>(null)
  const downRef = useRef<HTMLButtonElement>(null)

  // Keep focus on the move buttons as the row moves (React may re-insert it); at the top or
  // bottom the pressed button is disabled, so focus goes to the other one.
  function moveAndKeepFocus(move: (() => void) | undefined, pressed: 'up' | 'down') {
    if (!move) return
    move()
    window.requestAnimationFrame(() => {
      const first = pressed === 'up' ? upRef.current : downRef.current
      const other = pressed === 'up' ? downRef.current : upRef.current
      const target = first && !first.disabled ? first : other
      if (target && document.activeElement !== target) target.focus()
    })
  }

  return (
    <li
      ref={setRowElement}
      style={style}
      data-dragging={isDragging || undefined}
      className={cn(sortableRowVariants(), 'flex items-center gap-2 py-2', className)}
    >
      <Button variant="ghost" size="grip" {...handleProps}>
        <GripVertical aria-hidden="true" />
      </Button>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">
        <bdi>{channel.name}</bdi>
      </span>
      <Button
        ref={upRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${channel.name} up`}
        disabled={!moveUp}
        onClick={() => moveAndKeepFocus(moveUp, 'up')}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        ref={downRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${channel.name} down`}
        disabled={!moveDown}
        onClick={() => moveAndKeepFocus(moveDown, 'down')}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Rename ${channel.name}`}
        onClick={(event) => rename(event.currentTarget)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${channel.name}`}
        onClick={(event) => remove(event.currentTarget)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  )
}
