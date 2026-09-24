// TODO(api): replace with meQueryOptions; use contract types from schema, don't keep this shape.

import type { ComponentProps } from 'react'
import type { UserAvatar } from '@/components/user-avatar'

type PersonaTone = ComponentProps<typeof UserAvatar>['tone']

/** Presentational shape for the signed-in user in the app shell. Will be mapped from the API contract later. */
export interface ShellViewer {
  name: string
  tone?: PersonaTone
}

export const sampleViewer: ShellViewer = { name: 'Arzl', tone: 'persona-3' }
