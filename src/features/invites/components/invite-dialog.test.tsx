import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { apiError } from '@/test/msw/invites'
import { recordRequests } from '@/test/msw/requests'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

const INVITE_URL = `http://localhost:5173/invite/${'t'.repeat(43)}`

async function openInvite() {
  // userEvent.setup() installs a clipboard stub on navigator.clipboard for this test.
  const user = userEvent.setup()
  await renderRoute(roomPath(nightOwls, 'general'))
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  const dialog = await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
  return { user, dialog }
}

describe('InviteDialog', () => {
  it('creates a link with the default options and shows its URL once, with Copy', async () => {
    server.use(
      http.post('*/api/rooms/:roomId/invites', () =>
        HttpResponse.json(
          {
            invite: {
              id: 'f1000000-0000-4000-8000-000000000001',
              roomId: nightOwls.room.id,
              kind: 'link',
              createdBy: null,
              inviteeSteamId: null,
              maxUses: null,
              uses: 0,
              expiresAt: null,
              createdAt: '2026-09-27T10:00:00.000Z',
              status: 'active',
            },
            token: 't'.repeat(43),
            url: INVITE_URL,
          },
          { status: 201 },
        ),
      ),
    )
    const created = recordRequests('post', '*/api/rooms/:roomId/invites')
    const { user, dialog } = await openInvite()

    await user.click(within(dialog).getByRole('button', { name: 'Create link' }))

    const link = await within(dialog).findByRole('textbox', { name: 'Invite link' })
    expect(created.bodies).toEqual([{ kind: 'link', expiresIn: '7d', maxUses: null }])
    expect(link).toHaveValue(INVITE_URL)
    expect(link).toHaveAccessibleDescription("You won't see this link again. Copy it now.")
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    await expect(navigator.clipboard.readText()).resolves.toBe(INVITE_URL)
  })

  it('puts a 409 ALREADY_MEMBER on the SteamID64 field', async () => {
    server.use(
      http.post('*/api/rooms/:roomId/invites', () =>
        apiError(409, 'ALREADY_MEMBER', 'That Steam account is already in the room.'),
      ),
    )
    const { user, dialog } = await openInvite()
    await user.click(within(dialog).getByRole('tab', { name: 'Invite a Steam user' }))

    const field = within(dialog).getByRole('textbox', { name: 'SteamID64' })
    await user.type(field, '76561197960287931')
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(await within(dialog).findByText("They're already in this room.")).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(/They're already in this room\./)
  })
})
