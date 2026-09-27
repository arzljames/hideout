import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, LogIn } from 'lucide-react'
import { useEffect } from 'react'
import { TopBar } from '@/components/top-bar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { authErrorMessage, meQueryOptions, useSteamSignIn } from '@/features/auth'
import { ApiError } from '@/lib/api/client'
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
 * The link invite page: preview, then Join (signed in) or "Sign in with Steam to join". Sign-in
 * opens Steam in a new tab and this page refreshes `me` when it reports back; the token is kept
 * in sessionStorage in case sign-in falls back to a full-page redirect (Home sends it back here).
 */
export function InviteScreen({ token, className }: InviteScreenProps) {
  useNoReferrer()
  const { data: preview } = useSuspenseQuery(invitePreviewQueryOptions(token))
  // Can't tell (offline, 5xx) counts as signed out: the sign-in button is still useful.
  const viewer = useQuery(meQueryOptions).data ?? null
  const steam = useSteamSignIn({ goHome: false })
  const redeem = useRedeemInvite(token)

  const signedIn = viewer !== null
  useEffect(() => {
    if (signedIn) clearPendingInviteToken()
  }, [signedIn])

  function signIn() {
    storePendingInviteToken(token)
    steam.start()
  }

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
            <>
              {steam.authError && (
                <Alert variant="destructive" className="text-left">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Couldn&apos;t sign you in</AlertTitle>
                  <AlertDescription>{authErrorMessage(steam.authError)}</AlertDescription>
                </Alert>
              )}
              {/* Stays enabled so a closed Steam tab can be reopened. */}
              <Button type="button" size="lg" className="w-full" onClick={signIn}>
                <LogIn aria-hidden="true" />
                Sign in with Steam to join
              </Button>
              <p role="status" className="min-h-4 text-xs text-muted-foreground">
                {steam.waiting ? 'Finish signing in in the Steam tab.' : null}
              </p>
            </>
          )}
        </InviteCard>
      </main>
    </div>
  )
}
