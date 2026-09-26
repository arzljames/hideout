import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  authErrorSearchSchema,
  meQueryOptions,
  SignInScreen,
  useConsumeAuthError,
  useSteamSignIn,
  type Me,
} from '@/features/auth'

export const Route = createFileRoute('/sign-in')({
  validateSearch: authErrorSearchSchema,
  beforeLoad: async ({ context }) => {
    let me: Me | null
    try {
      me = await context.queryClient.ensureQueryData(meQueryOptions)
    } catch {
      // Can't tell (offline, 5xx): show the sign-in screen anyway.
      return
    }
    if (me) throw redirect({ to: '/' })
  },
  component: SignInRoute,
})

function SignInRoute() {
  const { auth_error } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Strip the one-shot param from the URL; the screen keeps showing the message.
  const urlAuthError = useConsumeAuthError(
    auth_error,
    () => void navigate({ to: '/sign-in', search: {}, replace: true }),
  )
  const steam = useSteamSignIn()
  // Once a popup attempt starts, only its own outcome is shown.
  const authError = steam.started ? steam.authError : urlAuthError

  return <SignInScreen authError={authError} onSignIn={steam.start} waiting={steam.waiting} />
}
