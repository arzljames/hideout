import { createFileRoute } from '@tanstack/react-router'
import { authErrorSearchSchema, useAuthErrorToast } from '@/features/auth'
import { HomeScreen } from '@/features/home'

export const Route = createFileRoute('/_app/')({
  validateSearch: authErrorSearchSchema,
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
