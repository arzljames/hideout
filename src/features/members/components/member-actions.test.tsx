import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import type { Member, RoomDetail } from '@/features/rooms'
import { failOnConsoleError } from '@/test/console-guard'
import { fakeSupabase } from '@/test/fake-supabase'
import { meFixture } from '@/test/fixtures/me'
import { nightOwls, raidNight, rockAndStone, roomFixtures, roomPath } from '@/test/fixtures/rooms'
import { roomDetailHandler } from '@/test/msw/rooms'
import { server } from '@/test/msw/server'
import { renderRoute } from '@/test/render'

failOnConsoleError()

function membersPanel() {
  return screen.getByRole('complementary', { name: 'Members' })
}

function optionsButton(name: string) {
  return within(membersPanel()).queryByRole('button', { name: `Member options for ${name}` })
}

async function menuItems(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(optionsButton(name)!)
  const menu = await screen.findByRole('menu')
  const items = within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent)
  await user.keyboard('{Escape}')
  return items
}

const memberOf = (room: RoomDetail, name: string): Member =>
  room.members.find((member) => member.user.displayName === name)!

describe('member actions in the sidebar', () => {
  it('owner: Make admin, Transfer ownership and Remove on a member; nothing on themself', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))

    expect(await menuItems(user, 'Jun')).toEqual([
      'Make admin',
      'Transfer ownership',
      'Remove from room',
    ])
    expect(await menuItems(user, 'Maya')).toEqual([
      'Remove admin',
      'Transfer ownership',
      'Remove from room',
    ])
    expect(optionsButton('Arzl')).not.toBeInTheDocument()
  })

  it('admin: only Remove on a plain member; plain member: no menus at all', async () => {
    const user = userEvent.setup()
    // Raid Night with a plain member (Jun) added; you're an admin there.
    const withJun: RoomDetail = {
      ...raidNight,
      members: [...raidNight.members, { ...memberOf(nightOwls, 'Jun'), roomId: raidNight.room.id }],
    }
    server.use(roomDetailHandler(roomFixtures.map((room) => (room === raidNight ? withJun : room))))
    const { unmount } = await renderRoute(roomPath(raidNight, 'lobby'))

    expect(await menuItems(user, 'Jun')).toEqual(['Remove from room'])
    expect(optionsButton('Theo')).not.toBeInTheDocument() // the owner
    unmount()

    await renderRoute(roomPath(rockAndStone, 'general'))
    expect(within(membersPanel()).queryByRole('button', { name: /^Member options/ })).toBeNull()
  })

  it('removes a member after confirming', async () => {
    const user = userEvent.setup()
    const removed = vi.fn()
    server.use(
      http.delete('*/api/rooms/:roomId/members/:userId', ({ params }) => {
        removed(params.userId)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await renderRoute(roomPath(nightOwls, 'general'))

    await user.click(optionsButton('Jun')!)
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from room' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Jun from Night Owls?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(removed).toHaveBeenCalledWith(memberOf(nightOwls, 'Jun').user.id)
    expect(within(membersPanel()).queryByText('Jun')).not.toBeInTheDocument()
  })

  it('transfers ownership: you become an admin and owner-only controls disappear', async () => {
    const user = userEvent.setup()
    const jun = memberOf(nightOwls, 'Jun')
    const after: RoomDetail = {
      ...nightOwls,
      myRole: 'admin',
      members: nightOwls.members.map((member) =>
        member.user.id === meFixture.id
          ? { ...member, role: 'admin' }
          : member.user.id === jun.user.id
            ? { ...member, role: 'owner' }
            : member,
      ),
    }
    server.use(
      http.post('*/api/rooms/:roomId/transfer-ownership', async ({ request }) => {
        expect(await request.json()).toEqual({ userId: jun.user.id })
        return HttpResponse.json(after)
      }),
    )
    await renderRoute(roomPath(nightOwls, 'general'))

    await user.click(optionsButton('Jun')!)
    await user.click(await screen.findByRole('menuitem', { name: 'Transfer ownership' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Make Jun the owner?' })
    await user.click(within(dialog).getByRole('button', { name: 'Transfer ownership' }))

    await waitFor(() => expect(optionsButton('Jun')).not.toBeInTheDocument())
    // An admin can't act on the new owner or on another admin; plain members: Remove only.
    expect(optionsButton('Maya')).not.toBeInTheDocument()
    expect(await menuItems(user, 'Alex')).toEqual(['Remove from room'])
    expect(
      within(membersPanel()).getByRole('region', { name: 'Owner — 1' }),
    ).toHaveTextContent('Jun')
  })
})

describe('leaving a room', () => {
  it('goes Home with a toast; a 409 OWNER_PROTECTED keeps the dialog open with the reason', async () => {
    const user = userEvent.setup()
    let status = 409
    server.use(
      http.delete('*/api/rooms/:roomId/members/me', () =>
        status === 409
          ? HttpResponse.json(
              { error: { code: 'OWNER_PROTECTED', message: 'The owner cannot leave.' } },
              { status: 409 },
            )
          : new HttpResponse(null, { status: 204 }),
      ),
    )
    const { router } = await renderRoute(roomPath(rockAndStone, 'general'))

    await user.click(screen.getByRole('button', { name: 'Rock and Stone' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Leave room' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave Rock and Stone?' })
    await user.click(within(dialog).getByRole('button', { name: 'Leave room' }))

    expect(
      await within(dialog).findByText(
        "The owner can't leave or be removed. Transfer ownership or delete the room first.",
      ),
    ).toBeInTheDocument()

    status = 204
    await user.click(within(dialog).getByRole('button', { name: 'Leave room' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      await screen.findByText(
        (text) => text.startsWith('You left') && text.includes('Rock and Stone'),
      ),
    ).toBeInTheDocument()
  })
})

describe('member realtime events', () => {
  it('member:role_changed for you updates your controls; member:left removes the row', async () => {
    const user = userEvent.setup()
    await renderRoute(roomPath(nightOwls, 'general'))
    const topic = `room:${nightOwls.room.id}`
    await vi.waitFor(() => expect(fakeSupabase.channelsFor(topic)).toHaveLength(1))
    const channel = fakeSupabase.channelsFor(topic)[0]!
    const jun = memberOf(nightOwls, 'Jun')

    // A transfer made elsewhere: two events.
    act(() => {
      channel.emitBroadcast('member:role_changed', {
        roomId: nightOwls.room.id,
        userId: jun.user.id,
        role: 'owner',
      })
      channel.emitBroadcast('member:role_changed', {
        roomId: nightOwls.room.id,
        userId: meFixture.id,
        role: 'admin',
      })
    })

    // Query updates reach the screen on the notify tick, after act.
    await waitFor(() => expect(optionsButton('Jun')).not.toBeInTheDocument())
    expect(await menuItems(user, 'Alex')).toEqual(['Remove from room'])

    act(() => {
      channel.emitBroadcast('member:left', { roomId: nightOwls.room.id, userId: jun.user.id })
    })
    await waitFor(() =>
      expect(within(membersPanel()).queryByText('Jun')).not.toBeInTheDocument(),
    )
  })
})
