import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react'
import type { Channel } from '@/features/rooms'

/** What each row gets to render itself as a sortable, manageable channel. */
export interface SortableChannelItem {
  /** 0-based position in its group, and the group's size. */
  index: number
  count: number
  /** Put on the row element (the `li`). */
  setRowElement: (element: HTMLElement | null) => void
  /** Put on the row element: the drag transform (no transition under reduced motion, via CSS). */
  style: CSSProperties
  isDragging: boolean
  /** Spread on the drag handle button (it's the only drag activator). Includes the aria-label. */
  handleProps: ButtonHTMLAttributes<HTMLButtonElement> & { ref: Ref<HTMLButtonElement> }
  /** Undefined at the top / bottom. */
  moveUp?: () => void
  moveDown?: () => void
  /** Open Rename / Delete; focus returns to `returnFocus` on close (or the list's fallback). */
  rename: (returnFocus: HTMLElement | null) => void
  remove: (returnFocus: HTMLElement | null) => void
}

interface SortableChannelRowProps {
  channel: Channel
  index: number
  count: number
  move: (from: number, to: number) => void
  rename: (channel: Channel, returnFocus: HTMLElement | null) => void
  remove: (channel: Channel, returnFocus: HTMLElement | null) => void
  children: (channel: Channel, item: SortableChannelItem) => ReactNode
}

/** Adapts `useSortable` for `SortableChannelList`'s render prop; renders no element itself. */
export function SortableChannelRow({
  channel,
  index,
  count,
  move,
  rename,
  remove,
  children,
}: SortableChannelRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id })

  return children(channel, {
    index,
    count,
    setRowElement: setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition },
    isDragging,
    handleProps: {
      ...attributes,
      ...listeners,
      ref: setActivatorNodeRef,
      type: 'button',
      'aria-label': `Reorder #${channel.name}`,
    },
    moveUp: index > 0 ? () => move(index, index - 1) : undefined,
    moveDown: index < count - 1 ? () => move(index, index + 1) : undefined,
    rename: (returnFocus) => rename(channel, returnFocus),
    remove: (returnFocus) => remove(channel, returnFocus),
  })
}
