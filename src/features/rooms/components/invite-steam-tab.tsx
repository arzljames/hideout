import { Send } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface InviteSteamTabProps {
  className?: string
}

/** Invite a specific Steam user by profile URL or friend name. */
export function InviteSteamTab({ className }: InviteSteamTabProps) {
  const ids = { input: useId(), hint: useId() }

  return (
    <FieldGroup className={cn('gap-4', className)}>
      <Field>
        <FieldLabel htmlFor={ids.input}>Steam profile URL or friend name</FieldLabel>
        <Input
          id={ids.input}
          autoComplete="off"
          placeholder="steamcommunity.com/id/…"
          aria-describedby={ids.hint}
        />
        <FieldDescription id={ids.hint}>
          They&apos;ll see the invite in Hideout next time they sign in with Steam.
        </FieldDescription>
      </Field>
      {/* TODO(api): send a direct invite to the Steam user. */}
      <Button type="button" className="self-start">
        <Send aria-hidden="true" />
        Send invite
      </Button>
    </FieldGroup>
  )
}
