import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { useVoiceStore } from '@/features/voice'
import { renderRoute } from '@/test/render'

failOnConsoleError()

/** The participant tile (list item) for `name` in the voice grid. */
function tile(name: string) {
  const participants = screen.getByRole('list', { name: 'Participants' })
  const item = within(participants)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(name, { exact: true }))
  if (!item) throw new Error(`No tile for ${name}`)
  return item
}

describe('TextChannelView empty state', () => {
  it('shows "This is the start of #clips" for an empty text channel, with the composer', async () => {
    await renderRoute('/rooms/night-owls/clips')

    expect(
      screen.getByRole('heading', { level: 2, name: 'This is the start of #clips' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Only members of Night Owls can see what's posted here. Say hi, or drop the first clip."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message #clips' })).toBeInTheDocument()
  })
})

describe('VoiceChannelView', () => {
  it('shows "No one\'s here yet" with Join voice for an empty voice channel', async () => {
    await renderRoute('/rooms/night-owls/late-night')

    expect(screen.getByRole('heading', { level: 1, name: 'late night' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: "No one's here yet" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Participants' })).not.toBeInTheDocument()
    expect(screen.getByText('0 in voice')).toBeInTheDocument()
  })

  it('shows how many people are in voice in the header', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(screen.getByText('5 in voice')).toBeInTheDocument()
  })

  it('shows Speaking, Muted and Deafened as text badges', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(tile('Maya')).toHaveTextContent('Speaking')
    expect(tile('Jun')).toHaveTextContent('Muted')
    // Deafened replaces Muted rather than adding to it.
    expect(tile('Priya')).toHaveTextContent('Deafened')
    expect(tile('Priya')).not.toHaveTextContent('Muted')
    expect(tile('Alex')).not.toHaveTextContent(/Speaking|Muted|Deafened/)
  })

  it('shows members\' activity on their tiles', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(tile('Maya')).toHaveTextContent('Playing Elden Ring')
    expect(tile('Jun')).toHaveTextContent('Playing Deep Rock Galactic')
  })

  it('marks your own tile with "(you)"', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(tile('Arzl')).toHaveTextContent('(you)')
    const participants = screen.getByRole('list', { name: 'Participants' })
    expect(within(participants).getAllByText('(you)')).toHaveLength(1)
  })

  it('reflects your own mute and deafen from the voice controls', async () => {
    const user = userEvent.setup()
    await renderRoute('/rooms/night-owls/voice')
    expect(tile('Arzl')).not.toHaveTextContent(/Muted|Deafened/)

    await user.click(screen.getByRole('button', { name: 'Mute' }))
    expect(tile('Arzl')).toHaveTextContent('Muted')

    await user.click(screen.getByRole('button', { name: 'Deafen' }))
    expect(tile('Arzl')).toHaveTextContent('Deafened')
    expect(tile('Arzl')).not.toHaveTextContent('Muted')
  })

  describe('when you are not connected to the channel', () => {
    beforeEach(() => {
      useVoiceStore.setState({ connection: null })
    })

    it('leaves out your own tile and offers a Join voice bar', async () => {
      await renderRoute('/rooms/night-owls/voice')

      const participants = screen.getByRole('list', { name: 'Participants' })
      expect(within(participants).getAllByRole('listitem')).toHaveLength(4)
      expect(within(participants).queryByText('(you)')).not.toBeInTheDocument()
      expect(within(participants).queryByText('Arzl', { exact: true })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Join voice' })).toBeInTheDocument()
      // Header and Join bar both count the people actually in voice.
      expect(screen.getAllByText('4 in voice')).toHaveLength(2)
    })

    it('leaves you out of the channel panel list too', async () => {
      await renderRoute('/rooms/night-owls/voice')

      const channels = screen.getByRole('navigation', { name: 'Channels' })
      const inVoice = within(channels).getByRole('list', { name: 'In voice' })
      expect(within(inVoice).getAllByRole('listitem')).toHaveLength(4)
      expect(within(inVoice).queryByText('Arzl', { exact: false })).not.toBeInTheDocument()
      expect(within(channels).getByRole('link', { name: 'voice' })).toBeInTheDocument()
    })
  })

  it('has no Join bar while you are connected to the channel', async () => {
    await renderRoute('/rooms/night-owls/voice')

    expect(screen.queryByRole('button', { name: 'Join voice' })).not.toBeInTheDocument()
  })
})
