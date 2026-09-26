import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { nightOwls, raidNight, roomPath } from '@/test/fixtures/rooms'
import { renderRoute, renderWithProviders } from '@/test/render'
import { getSampleInviteLinks } from '../sample-invite-links'
import { InvitesSection } from './invites-section'

failOnConsoleError()

// Invite links aren't wired to the API yet: rooms from the API show the empty state, and the
// list is tested with the design sample links rendered directly.
function renderSampleInvites(sampleRoomId = 'night-owls') {
  const user = userEvent.setup()
  renderWithProviders(
    <InvitesSection roomName="Night Owls" inviteLinks={getSampleInviteLinks(sampleRoomId)} />,
  )
  return { user }
}

async function renderInvites() {
  const user = userEvent.setup()
  await renderRoute(`${roomPath(nightOwls)}/settings?section=invites`)
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
  it('lists active links with code, creator, uses and expiry', () => {
    renderSampleInvites()

    const list = screen.getByRole('list', { name: 'Active invite links' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(linkRow('7Hq2xK')).toHaveTextContent('Created by Maya · 3 / 10 uses · Expires in 5 hours')
    expect(linkRow('p4LmZw')).toHaveTextContent('Created by Arzl · 12 uses · Never expires')
  })

  it("shows another room's links", () => {
    renderSampleInvites('raid-night')

    expect(linkRow('R41dNt')).toHaveTextContent('Created by Theo · 1 / 5 uses · Expires in 1 day')
  })

  it('uses the singular for one use on an unlimited link', () => {
    renderWithProviders(
      <InvitesSection
        roomName="Night Owls"
        inviteLinks={[{ code: 'One111', createdBy: 'Jun', uses: 1, maxUses: null, expiresIn: null }]}
      />,
    )

    expect(linkRow('One111')).toHaveTextContent('Created by Jun · 1 use · Never expires')
  })

  it('confirms Revoke and returns focus to it on Cancel', async () => {
    const { user } = renderSampleInvites()
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

  it('returns focus to Revoke on Escape', async () => {
    const { user } = renderSampleInvites()
    const revoke = screen.getByRole('button', { name: 'Revoke invite p4LmZw' })

    await user.click(revoke)
    await screen.findByRole('alertdialog', { name: 'Revoke invite p4LmZw?' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(revoke).toHaveFocus()
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

  it('shows an empty state for a room with no active links', async () => {
    // Invite links aren't loaded from the API yet, so every real room shows the empty state.
    await renderInvites()

    expect(screen.getByRole('heading', { level: 1, name: 'Invites' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active invite links' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'No active invite links' })).toBeInTheDocument()
    expect(screen.getByText('Create one to let your squad in.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument()
  })

  it('keeps invite codes out of the room data (they are credentials)', () => {
    expect(JSON.stringify([nightOwls, raidNight])).not.toContain('7Hq2xK')
  })
})
