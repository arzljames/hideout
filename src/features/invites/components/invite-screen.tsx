import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, LogIn } from 'lucide-react'
import { useEffect } from 'react'
import { TopBar } from '@/components/top-bar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { meQueryOptions } from '@/features/auth'
import { ApiError, apiUrl } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { invitePreviewQueryOptions, useRedeemInvite } from '../api'
import { inviteErrorMessage, isInviteGone } from '../invite-errors'
import { useNoReferrer } from '../no-referrer'
import { clearPendingInviteToken, storePendingInviteToken } from '../pending-invite-token'
import { InviteCard } from './invite-card'

interface InviteScreenProps {
  token: string
  className?: string
}

/**
 * The link invite page: preview, then Join (signed in) or "Sign in with Steam to join". Sign-in is
 * a same-tab navigation; the token is kept in sessionStorage so Home sends the user back here.
 */
export function InviteScreen({ token, className }: InviteScreenProps) {
  useNoReferrer()
  const { data: preview } = useSuspenseQuery(invitePreviewQueryOptions(token))
  // Can't tell (offline, 5xx) counts as signed out: the sign-in button is still useful.
  const viewer = useQuery(meQueryOptions).data ?? null
  const redeem = useRedeemInvite(token)

  const signedIn = viewer !== null
  useEffect(() => {
    if (signedIn) clearPendingInviteToken()
  }, [signedIn])

  const redeemError = redeem.error
  // Retrying won't help once the invite is gone or the viewer is banned.
  const joinBlocked =
    isInviteGone(redeemError) || (redeemError instanceof ApiError && redeemError.code === 'BANNED')

  return (
    <div className={cn('flex min-h-svh flex-col', className)}>
      <TopBar user={viewer ? { name: viewer.displayName, avatarUrl: viewer.avatarUrl } : undefined} />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <InviteCard preview={preview} className="w-full max-w-sm">
          {signedIn ? (
            <>
              {redeemError && (
                <Alert variant="destructive" className="text-left">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Couldn&apos;t join</AlertTitle>
                  <AlertDescription>
                    {inviteErrorMessage(redeemError, "Couldn't join the room. Try again.")}
                  </AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={redeem.isPending || joinBlocked}
                onClick={() => redeem.mutate()}
              >
                {redeem.isPending && (
                  <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                )}
                Join room
              </Button>
              <p role="status" className="min-h-4 text-xs text-muted-foreground">
                {redeem.isPending ? 'Joining…' : null}
              </p>
            </>
          ) : (
            // Store the token just before the full-page navigation (no preventDefault).
            <Button asChild size="lg" className="w-full">
              <a href={apiUrl('/api/auth/steam')} onClick={() => storePendingInviteToken(token)}>
                <LogIn aria-hidden="true" />
                Sign in with Steam to join
              </a>
            </Button>
          )}
        </InviteCard>
      </main>
    </div>
  )
}
