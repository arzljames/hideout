import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { getViewerRole, type Room } from '@/features/rooms'
import { cn } from '@/lib/utils'
import { overviewDefaults, overviewSchema, type OverviewValues } from '../overview-schema'
import { DangerZone } from './danger-zone'
import { RoomIconField } from './room-icon-field'
import { RoomNameField } from './room-name-field'
import { SettingsSectionHeader } from './settings-section-header'

interface OverviewSectionProps {
  room: Room
  className?: string
}

/** Room icon and name (one form), then the owner-only danger zone. */
export function OverviewSection({ room, className }: OverviewSectionProps) {
  const form = useForm<OverviewValues>({
    resolver: zodResolver(overviewSchema),
    defaultValues: overviewDefaults(room),
  })
  const emoji = useWatch({ control: form.control, name: 'emoji' })

  function onValid(values: OverviewValues) {
    // TODO(api): update room mutation; map 422 to form.setError; invalidate the room query.
    form.reset(values)
    toast.success('Changes saved')
  }

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <SettingsSectionHeader title="Overview" />

      <form noValidate onSubmit={(event) => void form.handleSubmit(onValid)(event)}>
        <FieldGroup>
          <RoomIconField
            value={emoji}
            onChange={(next) => form.setValue('emoji', next, { shouldDirty: true })}
          />
          <RoomNameField control={form.control} />
          <Button type="submit" className="self-start" disabled={!form.formState.isDirty}>
            Save changes
          </Button>
        </FieldGroup>
      </form>

      {/* UI-only gate; hideout-api must enforce the role on every settings mutation. */}
      {getViewerRole(room) === 'owner' && (
        <>
          <Separator />
          <DangerZone roomName={room.name} />
        </>
      )}
    </div>
  )
}
