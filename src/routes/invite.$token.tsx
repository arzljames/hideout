import { createFileRoute } from '@tanstack/react-router'
import { InviteScreen } from '@/features/invites'

export const Route = createFileRoute('/invite/$token')({
  component: InviteScreen,
})
