import { createFileRoute, redirect } from '@tanstack/react-router'
import { authErrorSearchSchema, useAuthErrorToast } from '@/features/auth'
import { HomeScreen } from '@/features/home'
import { takePendingInviteToken } from '@/features/invites'

export const Route = createFileRoute('/_app/')({
  validateSearch: authErrorSearchSchema,
  beforeLoad: ({ preload }) => {
    // A preload (hovering a Home link) must not consume the one-shot token.
    if (preload) return
    // Same-tab Steam sign-in started on an invite page lands here: send them back to it.
    const token = takePendingInviteToken()
    if (token) throw redirect({ to: '/invite/$token', params: { token }, replace: true })
  },
  component: HomeRoute,
})

function HomeRoute() {
  const { auth_error } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Already signed in, but the API redirected here after a failed sign-in attempt.
  useAuthErrorToast(
    auth_error,
    () => void navigate({ to: '/', search: {}, replace: true }),
  )

  return <HomeScreen />
}
