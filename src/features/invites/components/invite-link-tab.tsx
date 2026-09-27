import { CircleAlert, Copy, Link as LinkIcon, LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { ApiError } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { useCreateInvite } from '../api'
import { inviteErrorMessage } from '../invite-errors'
import {
  DEFAULT_EXPIRY,
  DEFAULT_MAX_USES,
  describeInviteLink,
  EXPIRY_OPTIONS,
  isInviteExpiry,
  isInviteMaxUses,
  MAX_USES_OPTIONS,
  maxUsesForRequest,
  type InviteExpiry,
  type InviteMaxUses,
} from '../invite-options'

interface InviteLinkTabProps {
  roomId: string
  roomName: string
  className?: string
}

/**
 * Create a shareable link (expiry and max uses), then show it once with Copy. The API returns
 * the URL only in the create response; it can't be fetched again.
 */
export function InviteLinkTab({ roomId, roomName, className }: InviteLinkTabProps) {
  const ids = { link: useId(), once: useId(), help: useId(), expiry: useId(), maxUses: useId() }
  const [expiry, setExpiry] = useState<InviteExpiry>(DEFAULT_EXPIRY)
  const [maxUses, setMaxUses] = useState<InviteMaxUses>(DEFAULT_MAX_USES)
  const create = useCreateInvite(roomId)
  const url = create.data?.url

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error("Couldn't copy the invite link", {
        description: 'Select the link and copy it manually.',
      })
    }
  }

  if (url) {
    return (
      <FieldGroup className={cn('gap-4', className)}>
        <Field>
          <FieldLabel htmlFor={ids.link}>Invite link</FieldLabel>
          <div className="flex gap-2">
            <Input
              id={ids.link}
              readOnly
              value={url}
              aria-describedby={ids.once}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" onClick={() => void copyLink(url)}>
              <Copy aria-hidden="true" />
              Copy
            </Button>
          </div>
          <FieldDescription id={ids.once}>
            You won&apos;t see this link again. Copy it now.
          </FieldDescription>
        </Field>
        <Button type="button" variant="outline" className="self-start" onClick={() => create.reset()}>
          Create another link
        </Button>
      </FieldGroup>
    )
  }

  return (
    <FieldGroup className={cn('gap-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={ids.expiry}>Expire after</FieldLabel>
          <Select
            value={expiry}
            onValueChange={(value) => {
              if (isInviteExpiry(value)) setExpiry(value)
            }}
          >
            <SelectTrigger id={ids.expiry} className="w-full" aria-describedby={ids.help}>
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
            <SelectTrigger id={ids.maxUses} className="w-full" aria-describedby={ids.help}>
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

      {create.isError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            {create.error instanceof ApiError && create.error.status === 403
              ? 'Only owners and admins can create invite links.'
              : inviteErrorMessage(create.error, "Couldn't create the link. Try again.")}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate({
            kind: 'link',
            expiresIn: expiry,
            maxUses: maxUsesForRequest(maxUses),
          })
        }
      >
        {create.isPending ? (
          <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
        ) : (
          <LinkIcon aria-hidden="true" />
        )}
        Create link
      </Button>
    </FieldGroup>
  )
}
