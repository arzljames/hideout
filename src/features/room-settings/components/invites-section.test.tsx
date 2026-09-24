import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { getSampleRoom } from '@/features/rooms'
import { renderRoute, renderWithProviders } from '@/test/render'
import { InvitesSection } from './invites-section'

failOnConsoleError()

function nightOwls() {
  const room = getSampleRoom('night-owls')
  if (!room) throw new Error('sample room missing')
  return room
}

async function renderInvites(roomId = 'night-owls') {
  const user = userEvent.setup()
  await renderRoute(`/rooms/${roomId}/settings?section=invites`)
  return { user }
}

function linkRow(code: string) {
  const list = screen.getByRole('list', { name: 'Active invite links' })
  const item = within(list)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(`hideout.gg/i/${code}`))
  if (!item) throw new Error(`No row for ${code}`)
  return item
}

describe('Invites section', () => {
  it('lists active links with code, creator, uses and expiry', async () => {
    await renderInvites()

    expect(screen.getByRole('heading', { level: 1, name: 'Invites' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Active invite links' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(linkRow('7Hq2xK')).toHaveTextContent('Created by Maya · 3 / 10 uses · Expires in 5 hours')
    expect(linkRow('p4LmZw')).toHaveTextContent('Created by Arzl · 12 uses · Never expires')
  })

  it("shows an admin room's links (raid-night)", async () => {
    await renderInvites('raid-night')

    expect(linkRow('R41dNt')).toHaveTextContent('Created by Theo · 1 / 5 uses · Expires in 1 day')
  })

  it('uses the singular for one use on an unlimited link', () => {
    renderWithProviders(
      <InvitesSection
        room={nightOwls()}
        inviteLinks={[{ code: 'One111', createdBy: 'Jun', uses: 1, maxUses: null, expiresIn: null }]}
      />,
    )

    expect(linkRow('One111')).toHaveTextContent('Created by Jun · 1 use · Never expires')
  })

  it('confirms Revoke and returns focus to it on Cancel', async () => {
    const { user } = await renderInvites()
    const revoke = within(linkRow('7Hq2xK')).getByRole('button', { name: 'Revoke invite 7Hq2xK' })

    await user.click(revoke)
    const dialog = await screen.findByRole('alertdialog', { name: 'Revoke invite 7Hq2xK?' })
    expect(dialog).toHaveAccessibleDescription(
      'The link stops working right away. People who already joined stay in the room.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(revoke).toHaveFocus()
  })

  it('returns focus to Revoke on Escape, without leaving settings', async () => {
    const { user } = await renderInvites()
    const revoke = screen.getByRole('button', { name: 'Revoke invite p4LmZw' })

    await user.click(revoke)
    await screen.findByRole('alertdialog', { name: 'Revoke invite p4LmZw?' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(revoke).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1, name: 'Invites' })).toBeInTheDocument()
  })

  it('opens the Invite dialog from Create invite link and returns focus on close', async () => {
    const { user } = await renderInvites()
    const create = screen.getByRole('button', { name: 'Create invite link' })

    await user.click(create)
    const dialog = await screen.findByRole('dialog', { name: 'Invite people to Night Owls' })
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(create).toHaveFocus()
  })

  it('shows an empty state for a room with no active links', () => {
    // Every sample room you can open settings for has links, so render the section directly.
    renderWithProviders(<InvitesSection room={nightOwls()} inviteLinks={[]} />)

    expect(screen.queryByRole('list', { name: 'Active invite links' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'No active invite links' })).toBeInTheDocument()
    expect(screen.getByText('Create one to let your squad in.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument()
  })

  it('keeps invite codes out of the room data (they are credentials)', () => {
    expect(JSON.stringify(nightOwls())).not.toContain('7Hq2xK')
  })
})
