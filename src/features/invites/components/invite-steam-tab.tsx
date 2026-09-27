import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle, Send } from 'lucide-react'
import { useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { setApiFieldErrors } from '@/features/rooms'
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useCreateInvite } from '../api'
import { inviteErrorMessage } from '../invite-errors'

/** SteamID64, as the contract's CreateInviteBody (direct) requires. */
const steamInviteSchema = z.object({
  steamId: z
    .string()
    .trim()
    .regex(/^7656119\d{10}$/, 'Enter a SteamID64: 17 digits starting with 7656119.'),
})

type SteamInviteValues = z.infer<typeof steamInviteSchema>

/** Conflicts that are about the person entered, so they belong on the field. */
const FIELD_CONFLICTS = new Set(['ALREADY_MEMBER', 'INVITE_ALREADY_PENDING', 'USER_BANNED'])

interface InviteSteamTabProps {
  roomId: string
  className?: string
}

/** Invite one Steam account by SteamID64 (any member). */
export function InviteSteamTab({ roomId, className }: InviteSteamTabProps) {
  const ids = { input: useId(), hint: useId(), error: useId() }
  const create = useCreateInvite(roomId)
  const form = useForm<SteamInviteValues>({
    resolver: zodResolver(steamInviteSchema),
    defaultValues: { steamId: '' },
  })
  const formError = form.formState.errors.root?.server?.message

  function onSubmit({ steamId }: SteamInviteValues) {
    create.mutate(
      { kind: 'direct', steamId },
      {
        onSuccess: () => {
          toast.success('Invite sent')
          form.reset()
        },
        onError: (error) => {
          const onField =
            error instanceof ApiError &&
            ((error.status === 409 && FIELD_CONFLICTS.has(error.code)) || error.status === 422)
          if (onField && error.status === 422) {
            const mapped = setApiFieldErrors(form.setError, error, (path) =>
              path === 'body.steamId' || path === 'steamId' ? 'steamId' : null,
            )
            if (mapped) return
          }
          const message = inviteErrorMessage(error, "Couldn't send the invite. Try again.")
          if (onField) {
            form.setError('steamId', { type: 'server', message }, { shouldFocus: true })
          } else {
            form.setError('root.server', { type: 'server', message })
          }
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className={cn(className)}>
      <FieldGroup className="gap-4">
        <Controller
          name="steamId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={ids.input}>SteamID64</FieldLabel>
              <Input
                {...field}
                id={ids.input}
                inputMode="numeric"
                autoComplete="off"
                placeholder="76561197960287930"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.invalid ? `${ids.error} ${ids.hint}` : ids.hint}
              />
              {fieldState.invalid && <FieldError id={ids.error} errors={[fieldState.error]} />}
              <FieldDescription id={ids.hint}>
                They&apos;ll see the invite in Hideout next time they sign in with Steam.
              </FieldDescription>
            </Field>
          )}
        />

        {formError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="self-start" disabled={create.isPending}>
          {create.isPending ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <Send aria-hidden="true" />
          )}
          Send invite
        </Button>
      </FieldGroup>
    </form>
  )
}
