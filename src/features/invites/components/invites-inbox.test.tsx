import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { nightOwls, roomPath } from '@/test/fixtures/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'
import type { InboxInvite } from '../types'

failOnConsoleError()

const maya = { id: 'e0000000-0000-4000-8000-000000000001', displayName: 'Maya', avatarUrl: null }

function inboxInvite(n: number, roomName: string): InboxInvite {
  return {
    inviteId: `f2000000-0000-4000-8000-00000000000${n}`,
    room: { id: `a9000000-0000-4000-8000-00000000000${n}`, name: roomName, icon: { kind: 'emoji', emoji: '🎮' } },
    invitedBy: maya,
    expiresAt: null,
  }
}

describe('Invites inbox', () => {
  it('Accept joins the room and opens its default channel', async () => {
    const invite = inboxInvite(1, 'Night Owls')
    invite.room.id = nightOwls.room.id
    server.use(
      http.get('*/api/me/invites', () => HttpResponse.json({ data: [invite] })),
      http.post('*/api/me/invites/:inviteId/accept', () =>
        HttpResponse.json({ status: 'accepted', room: nightOwls }),
      ),
    )
    const user = userEvent.setup()
    const { router } = await renderRoute('/invites')

    await user.click(screen.getByRole('button', { name: 'Accept invite to Night Owls' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(roomPath(nightOwls, 'general')))
    // The name is bidi-isolated in the toast.
    expect(await screen.findByText(/^Joined \W?Night Owls\W?$/)).toBeInTheDocument()
  })

  it('invite:received adds an entry and invite:revoked removes it', async () => {
    await renderRoute('/invites')
    expect(screen.getByRole('heading', { name: 'No pending invites' })).toBeInTheDocument()
    await vi.waitFor(() => expect(fakeSupabase.channelsFor(`user:${meFixture.id}`)).toHaveLength(1))
    const channel = fakeSupabase.channelsFor(`user:${meFixture.id}`)[0]!
    const invite = inboxInvite(2, 'Raid Night')

    act(() => channel.emitBroadcast('invite:received', invite))
    expect(await screen.findByRole('article', { name: 'Raid Night' })).toBeInTheDocument()
    // A repeat doesn't duplicate it.
    act(() => channel.emitBroadcast('invite:received', invite))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Home, 1 pending invite' })).toBeInTheDocument()

    act(() => channel.emitBroadcast('invite:revoked', { inviteId: invite.inviteId }))
    expect(await screen.findByRole('heading', { name: 'No pending invites' })).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
