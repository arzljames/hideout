import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react'
import type { Channel, ChannelType } from '@/features/rooms'
import { isolate } from '@/lib/bidi'
import { useReorderChannels } from '../api'
import { DeleteChannelDialog } from './delete-channel-dialog'
import { RenameChannelDialog } from './rename-channel-dialog'
import { SortableChannelRow, type SortableChannelItem } from './sortable-channel-row'

interface DialogTarget {
  channel: Channel
  returnFocus: HTMLElement | null
  /** Remounts the dialog per open, so each starts fresh. */
  key: number
}

/** `restrictToVerticalAxis` from @dnd-kit/modifiers, without the extra package. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder a channel, press Space or Enter on its handle to pick it up. Use the Up and ' +
    'Down arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
}

interface SortableChannelListProps {
  roomId: string
  type: ChannelType
  /** The room's channels of `type`, top first. */
  channels: readonly Channel[]
  /** Focus target when the control that opened a dialog is gone (e.g. its row was deleted). */
  fallbackFocusRef?: RefObject<HTMLElement | null>
  /** Render one row. Rendered without a wrapper, so the caller supplies the list element. */
  children: (channel: Channel, item: SortableChannelItem) => ReactNode
  /** Wrap the rows in the list element (e.g. a `ul`); without it the caller wraps this component. */
  renderList?: (rows: ReactNode) => ReactNode
  /**
   * Shown instead of the list when there are no channels. This component (and so an open Delete
   * dialog) stays mounted either way, e.g. while the group's last channel is being deleted.
   */
  empty?: ReactNode
}

/**
 * A reorderable group of channels (owners and admins), shared by the sidebar and Room settings:
 * drag by the handle (mouse, touch after a short press, or keyboard), or Move up / Move down.
 * Each drop or move sends one reorder (see `useReorderChannels`). Also owns the group's Rename
 * and Delete dialogs, so they outlive the row that opened them.
 */
export function SortableChannelList({
  roomId,
  type,
  channels,
  fallbackFocusRef,
  children,
  renderList = (rows) => rows,
  empty,
}: SortableChannelListProps) {
  const { reorder } = useReorderChannels(roomId)
  const ids = useMemo(() => channels.map((channel) => channel.id), [channels])
  const [renameTarget, setRenameTarget] = useState<DialogTarget | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DialogTarget | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const sensors = useSensors(
    // Mouse + Touch (not Pointer + Touch), the pairing dnd-kit documents: a touch then only
    // starts a drag after the press delay, and scrolling the list still works.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const announcements = useMemo<Announcements>(() => {
    const name = (id: UniqueIdentifier) =>
      `#${isolate(channels.find((channel) => channel.id === id)?.name ?? 'channel')}`
    const position = (id: UniqueIdentifier | undefined) =>
      `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`
    return {
      onDragStart: ({ active }) => `Picked up ${name(active.id)}, at ${position(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over ? `Moved ${name(active.id)} to ${position(over.id)}.` : undefined,
      onDragEnd: ({ active, over }) =>
        over
          ? `Dropped ${name(active.id)} at ${position(over.id)}.`
          : `Dropped ${name(active.id)}. It stays at ${position(active.id)}.`,
      onDragCancel: ({ active }) =>
        `Cancelled. ${name(active.id)} stays at ${position(active.id)}.`,
    }
  }, [channels, ids])

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to || to < 0 || to >= ids.length) return
      reorder(type, arrayMove(ids, from, to))
    },
    [ids, reorder, type],
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  // The latest cached copy (e.g. renamed meanwhile); the snapshot once it's gone.
  const current = (channel: Channel) => channels.find((item) => item.id === channel.id) ?? channel

  const fallback = (returnFocus: HTMLElement | null) => () =>
    returnFocus?.isConnected ? returnFocus : (fallbackFocusRef?.current ?? null)

  const rename = useCallback((channel: Channel, returnFocus: HTMLElement | null) => {
    setRenameTarget((previous) => ({ channel, returnFocus, key: (previous?.key ?? 0) + 1 }))
    setRenameOpen(true)
  }, [])
  const remove = useCallback((channel: Channel, returnFocus: HTMLElement | null) => {
    setDeleteTarget((previous) => ({ channel, returnFocus, key: (previous?.key ?? 0) + 1 }))
    setDeleteOpen(true)
  }, [])

  const rows = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{
        announcements,
        screenReaderInstructions,
        // Render the live region and instructions outside the list: a <ul> may only hold <li>s.
        container: typeof document === 'undefined' ? undefined : document.body,
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {channels.map((channel, index) => (
          <SortableChannelRow
            key={channel.id}
            channel={channel}
            index={index}
            count={channels.length}
            move={move}
            rename={rename}
            remove={remove}
          >
            {children}
          </SortableChannelRow>
        ))}
      </SortableContext>
    </DndContext>
  )
  const list = channels.length === 0 && empty !== undefined ? empty : renderList(rows)

  return (
    <>
      {list}

      {renameTarget && (
        <RenameChannelDialog
          key={`rename-${renameTarget.key}`}
          roomId={roomId}
          channel={current(renameTarget.channel)}
          siblings={channels}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          returnFocus={fallback(renameTarget.returnFocus)}
        />
      )}
      {deleteTarget && (
        <DeleteChannelDialog
          key={`delete-${deleteTarget.key}`}
          roomId={roomId}
          channel={current(deleteTarget.channel)}
          isLastTextChannel={type === 'text' && channels.length <= 1}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          returnFocus={fallback(deleteTarget.returnFocus)}
        />
      )}
    </>
  )
}
