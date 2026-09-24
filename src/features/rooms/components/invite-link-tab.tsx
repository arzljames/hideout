import { Copy } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  describeInviteLink,
  EXPIRY_OPTIONS,
  isInviteExpiry,
  isInviteMaxUses,
  MAX_USES_OPTIONS,
  type InviteExpiry,
  type InviteMaxUses,
} from '../invite-options'

// TODO(api): create the invite (with expiry and max uses) and show the returned URL.
const SAMPLE_INVITE_URL = 'https://hideout.gg/i/7Hq2xK'

interface InviteLinkTabProps {
  roomName: string
  className?: string
}

/** Shareable invite link with copy, expiry and max-uses settings. */
export function InviteLinkTab({ roomName, className }: InviteLinkTabProps) {
  const ids = { link: useId(), help: useId(), expiry: useId(), maxUses: useId() }
  const [expiry, setExpiry] = useState<InviteExpiry>(DEFAULT_EXPIRY)
  const [maxUses, setMaxUses] = useState<InviteMaxUses>(DEFAULT_MAX_USES)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SAMPLE_INVITE_URL)
      toast.success('Invite link copied')
    } catch {
      toast.error("Couldn't copy the invite link", {
        description: 'Select the link and copy it manually.',
      })
    }
  }

  return (
    <FieldGroup className={cn('gap-4', className)}>
      <Field>
        <FieldLabel htmlFor={ids.link}>Invite link</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={ids.link}
            readOnly
            value={SAMPLE_INVITE_URL}
            aria-describedby={ids.help}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" onClick={() => void copyLink()}>
            <Copy aria-hidden="true" />
            Copy
          </Button>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={ids.expiry}>Expire after</FieldLabel>
          <Select
            value={expiry}
            onValueChange={(value) => {
              if (isInviteExpiry(value)) setExpiry(value)
            }}
          >
            <SelectTrigger id={ids.expiry} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.maxUses}>Max uses</FieldLabel>
          <Select
            value={maxUses}
            onValueChange={(value) => {
              if (isInviteMaxUses(value)) setMaxUses(value)
            }}
          >
            <SelectTrigger id={ids.maxUses} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_USES_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <FieldDescription id={ids.help}>
        {describeInviteLink(roomName, expiry, maxUses)}
      </FieldDescription>
    </FieldGroup>
  )
}
