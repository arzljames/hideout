import { screen, within } from '@testing-library/react'
import { failOnConsoleError } from '@/test/console-guard'
import { getSampleRoom } from '@/features/rooms'
import { renderRoute, renderWithProviders } from '@/test/render'
import { ChannelsSection } from './channels-section'

failOnConsoleError()

describe('Channels section', () => {
  it('groups channels into labelled text and voice lists', async () => {
    await renderRoute('/rooms/night-owls/settings?section=channels')

    expect(screen.getByRole('heading', { level: 1, name: 'Channels' })).toBeInTheDocument()
    const text = screen.getByRole('list', { name: 'Text channels' })
    const voice = screen.getByRole('list', { name: 'Voice channels' })
    expect(within(text).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'general',
      'clips',
      'planning',
    ])
    expect(within(voice).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'voice',
      'late night',
    ])
    expect(screen.getByRole('region', { name: 'Text channels' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Voice channels' })).toBeInTheDocument()
  })

  it('has labelled Rename and Delete buttons for every channel', async () => {
    await renderRoute('/rooms/night-owls/settings?section=channels')

    for (const name of ['general', 'clips', 'planning', 'voice', 'late night']) {
      expect(screen.getByRole('button', { name: `Rename ${name}` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Delete ${name}` })).toBeInTheDocument()
    }
  })

  it('has a Create channel button in each group', async () => {
    await renderRoute('/rooms/night-owls/settings?section=channels')

    expect(screen.getAllByRole('button', { name: 'Create channel' })).toHaveLength(2)
    for (const group of ['Text channels', 'Voice channels']) {
      const region = screen.getByRole('region', { name: group })
      expect(within(region).getByRole('button', { name: 'Create channel' })).toBeInTheDocument()
    }
  })

  it('says so when a group has no channels', () => {
    const room = getSampleRoom('night-owls')
    if (!room) throw new Error('sample room missing')
    renderWithProviders(
      <ChannelsSection room={{ ...room, channels: room.channels.filter((c) => c.kind === 'text') }} />,
    )

    expect(screen.queryByRole('list', { name: 'Voice channels' })).not.toBeInTheDocument()
    expect(screen.getByText('No voice channels yet')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Text channels' })).toBeInTheDocument()
  })
})
