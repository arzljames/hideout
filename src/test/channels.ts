import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'

type User = ReturnType<typeof userEvent.setup>

/** The sidebar's "Channels" navigation. */
export function channelNav() {
  return screen.getByRole('navigation', { name: 'Channels' })
}

/** The sidebar's channel names in a group, top first (also while a modal hides the sidebar). */
export function sidebarNames(list: 'Text channels' | 'Voice channels') {
  const nav = screen.getByRole('navigation', { name: 'Channels', hidden: true })
  return within(within(nav).getByRole('list', { name: list, hidden: true }))
    .getAllByRole('link', { hidden: true })
    .map((link) => link.textContent?.trim())
}

/** Open a sidebar channel's "…" menu and pick an item. Returns the "…" button. */
export async function chooseChannelAction(
  user: User,
  channelName: string,
  action: 'Rename' | 'Move up' | 'Move down' | 'Delete',
) {
  const trigger = within(channelNav()).getByRole('button', {
    name: `Channel options for #${channelName}`,
  })
  await user.click(trigger)
  await user.click(await screen.findByRole('menuitem', { name: action }))
  return trigger
}

/** An API error response in the contract's ErrorResponse shape. */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: { path: string; message: string }[],
) {
  return HttpResponse.json({ error: { code, message, ...(details && { details }) } }, { status })
}
