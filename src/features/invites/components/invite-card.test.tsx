import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { sampleInvite, type InvitePreview } from '../sample-invite'
import { InviteCard } from './invite-card'

const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/** Finds a <p> whose combined text (across nested spans) matches `predicate`. */
function getParagraph(predicate: (text: string) => boolean) {
  return screen.getByText(
    (_, element) => element?.tagName === 'P' && predicate(normalize(element.textContent)),
  )
}

describe('InviteCard', () => {
  it('shows the room name, inviter, presence counts and landing channel', () => {
    renderWithProviders(<InviteCard invite={sampleInvite} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Night Owls' })).toBeInTheDocument()
    // The paragraph also contains the aria-hidden "M" initial, so match the sentence part.
    expect(getParagraph((text) => text.endsWith('Maya invited you to join'))).toBeInTheDocument()
    expect(screen.getByText('5 online')).toBeInTheDocument()
    expect(screen.getByText('7 members')).toBeInTheDocument()
    expect(getParagraph((text) => text === "You'll land in #general.")).toBeInTheDocument()
  })

  it('renders custom invite data and uses the singular for a single member', () => {
    const invite: InvitePreview = {
      inviter: { name: 'Jonas', tone: 'persona-2' },
      room: { name: 'Raid Night', emoji: '🐉', onlineCount: 0, memberCount: 1 },
      landingChannel: 'lobby',
    }
    renderWithProviders(<InviteCard invite={invite} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Raid Night' })).toBeInTheDocument()
    expect(getParagraph((text) => text.endsWith('Jonas invited you to join'))).toBeInTheDocument()
    expect(screen.getByText('0 online')).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
    expect(screen.queryByText('1 members')).not.toBeInTheDocument()
    expect(getParagraph((text) => text === "You'll land in #lobby.")).toBeInTheDocument()
  })

  it('keeps the Join room button inert until the invite API is wired up', async () => {
    const user = userEvent.setup()
    const before = window.location.href
    renderWithProviders(<InviteCard invite={sampleInvite} />)

    const button = screen.getByRole('button', { name: 'Join room' })
    expect(button).toHaveAttribute('type', 'button')
    await user.click(button)

    expect(window.location.href).toBe(before)
    expect(screen.getByRole('button', { name: 'Join room' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Night Owls' })).toBeInTheDocument()
  })

  it('hides the decorative emoji, inviter initial and presence dots from assistive technology', () => {
    renderWithProviders(<InviteCard invite={sampleInvite} />)

    expect(screen.getByText('🦉').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByText('M').closest('[aria-hidden="true"]')).not.toBeNull()

    for (const label of ['5 online', '7 members']) {
      const dot = screen.getByText(label).querySelector('span')
      expect(dot).not.toBeNull()
      expect(dot).toHaveAttribute('aria-hidden', 'true')
      expect(dot).toBeEmptyDOMElement()
    }
  })
})
