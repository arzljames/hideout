import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { sameRoomId, type Channel } from '@/features/rooms'
import { isolate } from '@/lib/bidi'
import { useRenameChannel } from '../api'
import { CHANNEL_MESSAGES, channelErrorMessage, setChannelFieldErrors } from '../channel-errors'
import {
  channelNameFormSchema,
  normalizeChannelName,
  type ChannelNameValues,
} from '../channel-name-schema'
import { useChannelErrorEffects } from '../hooks/use-channel-error-effects'
import { ChannelNameField } from './channel-name-field'

const FALLBACK_MESSAGE = "Couldn't rename the channel. Try again."

interface RenameChannelDialogProps {
  roomId: string
  channel: Channel
  /** The room's channels of the same type (the channel itself is ignored). */
  siblings: readonly Channel[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Focus target on close (the control that opened it), and a fallback when that's gone. */
  returnFocus: () => HTMLElement | null
}

/**
 * "Rename #name" dialog, prefilled with the current name. Give it a new `key` per open so each
 * open starts fresh (a realtime rename meanwhile doesn't overwrite what's being typed).
 */
export function RenameChannelDialog({
  roomId,
  channel,
  siblings,
  open,
  onOpenChange,
  returnFocus,
}: RenameChannelDialogProps) {
  const submitting = useRef(false)
  const errorEffects = useChannelErrorEffects(roomId)
  const renameChannel = useRenameChannel(roomId, channel.id)
  const schema = useMemo(
    () =>
      channelNameFormSchema(
        siblings.filter((item) => !sameRoomId(item.id, channel.id)).map((item) => item.name),
      ),
    [siblings, channel.id],
  )
  const form = useForm<ChannelNameValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: channel.name },
  })
  const formError = form.formState.errors.root?.server?.message
  const pending = renameChannel.isPending

  function handleOpenChange(next: boolean) {
    if (!next && renameChannel.isPending) return
    onOpenChange(next)
  }

  function handleSubmit(values: ChannelNameValues) {
    if (submitting.current) return
    if (normalizeChannelName(values.name) === channel.name) {
      onOpenChange(false)
      return
    }
    submitting.current = true
    form.clearErrors('root')
    renameChannel.mutate(values.name, {
      onSettled: () => {
        submitting.current = false
      },
      onSuccess: (renamed) => {
        toast.success(`Renamed to #${isolate(renamed.name)}`)
        onOpenChange(false)
      },
      onError: async (error) => {
        if (setChannelFieldErrors(form.setError, error)) return
        const outcome = await errorEffects(error)
        if (outcome === 'room-gone') return
        if (outcome === 'forbidden') {
          toast.error(CHANNEL_MESSAGES.forbidden)
          onOpenChange(false)
          return
        }
        form.setError('root.server', {
          type: 'server',
          message: channelErrorMessage(error, FALLBACK_MESSAGE),
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          form.setFocus('name', { shouldSelect: true })
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocus()
          if (!target?.isConnected) return
          event.preventDefault()
          target.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Rename #<bdi>{channel.name}</bdi>
          </DialogTitle>
          <DialogDescription>The new name shows for everyone in the room.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <ChannelNameField control={form.control} placeholder={channel.name} />
          </FieldGroup>

          {formError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
