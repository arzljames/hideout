import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  authErrorSearchSchema,
  meQueryOptions,
  SignInScreen,
  useConsumeAuthError,
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
  const authError = useConsumeAuthError(
    auth_error,
    () => void navigate({ to: '/sign-in', search: {}, replace: true }),
  )

  return <SignInScreen authError={authError} />
}
