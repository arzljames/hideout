import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import {
  roomFormErrorMessage,
  setRoomFieldErrors,
  useUpdateRoom,
  type RoomDetail,
} from '@/features/rooms'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import {
  overviewChanges,
  overviewDefaults,
  overviewSchema,
  overviewValues,
  type OverviewValues,
} from '../overview-schema'
import { DangerZone } from './danger-zone'
import { RoomIconField } from './room-icon-field'
import { RoomNameField } from './room-name-field'
import { SettingsSectionHeader } from './settings-section-header'

interface OverviewSectionProps {
  room: RoomDetail
  className?: string
}

/** Room icon and name (one form, saved with PATCH), then the owner-only danger zone. */
export function OverviewSection({ room, className }: OverviewSectionProps) {
  const roomId = room.room.id
  const updateRoom = useUpdateRoom(roomId)
  // The saved values, new whenever the room changes (a save here, or `room:updated` from
  // someone else; TanStack Query's structural sharing keeps `room.room` stable otherwise).
  // `values` re-bases the form on them; keepDirtyValues keeps what the user is editing, so
  // only untouched fields follow the latest room.
  const saved = useMemo(() => overviewValues(room.room), [room.room])
  const form = useForm<OverviewValues>({
    resolver: zodResolver(overviewSchema),
    defaultValues: saved,
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const emoji = useWatch({ control: form.control, name: 'emoji' })
  const emojiDirty = Boolean(form.formState.dirtyFields.emoji)

  function onValid(values: OverviewValues) {
    const body = overviewChanges(values, overviewDefaults(room), form.formState.dirtyFields)
    if (Object.keys(body).length === 0) {
      // Edited back to the saved values: nothing to send.
      form.reset(values)
      return
    }
    updateRoom.mutate(body, {
      onSuccess: (saved) => {
        form.reset(overviewDefaults(saved))
        toast.success('Saved')
      },
      onError: (error) => {
        // 403, 404 and 429 are toasted by useUpdateRoom; a 422 belongs on the fields.
        if (!(error instanceof ApiError) || error.status !== 422) return
        if (setRoomFieldErrors(form.setError, error)) return
        toast.error(roomFormErrorMessage(error, "Couldn't save changes. Try again."))
      },
    })
  }

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <SettingsSectionHeader title="Overview" />

      <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)}>
        <FieldGroup>
          <RoomIconField
            value={emoji}
            // Until a new emoji is picked, preview the room's actual icon (it may be an image).
            preview={emojiDirty ? undefined : room.room.icon}
            roomName={room.room.name}
            onChange={(next) => form.setValue('emoji', next, { shouldDirty: true })}
          />
          <RoomNameField control={form.control} />
          <Button
            type="submit"
            className="self-start"
            disabled={!form.formState.isDirty || updateRoom.isPending}
          >
            {updateRoom.isPending && (
              <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
            )}
            Save changes
          </Button>
        </FieldGroup>
      </form>

      {/* UI-only gate; hideout-api enforces the owner role on delete (403 is handled). */}
      {room.myRole === 'owner' && (
        <>
          <Separator />
          <DangerZone room={room} />
        </>
      )}
    </div>
  )
}
