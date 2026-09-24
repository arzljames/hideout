import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'
import { useVoiceStore } from '../voice-store'

failOnConsoleError()

async function renderBar() {
  const user = userEvent.setup()
  await renderRoute('/rooms/night-owls/general')
  const bar = screen.getByRole('region', { name: 'Voice connection' })
  return {
    user,
    bar,
    mute: within(bar).getByRole('button', { name: 'Mute' }),
    deafen: within(bar).getByRole('button', { name: 'Deafen' }),
  }
}

describe('VoiceConnectionBar', () => {
  it('shows the connection status, channel and room', async () => {
    const { bar } = await renderBar()

    expect(within(bar).getByText('Connected')).toBeInTheDocument()
    expect(within(bar).getByText('voice · Night Owls')).toBeInTheDocument()
    expect(within(bar).getByText('Good')).toHaveTextContent('Connection quality: Good')
  })

  it('has labelled Voice settings and Disconnect buttons', async () => {
    const { bar } = await renderBar()

    expect(within(bar).getByRole('button', { name: 'Voice settings' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
  })

  it('shows on Home too, since the voice session outlives the room page', async () => {
    await renderRoute('/')

    expect(screen.getByRole('region', { name: 'Voice connection' })).toBeInTheDocument()
  })

  it('renders nothing when not connected', async () => {
    useVoiceStore.setState({ connection: null })
    await renderRoute('/rooms/night-owls/general')

    expect(screen.queryByRole('region', { name: 'Voice connection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument()
  })

  it('toggles Mute with aria-pressed', async () => {
    const { user, mute } = await renderBar()
    expect(mute).toHaveAttribute('aria-pressed', 'false')

    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles Mute from the keyboard', async () => {
    const { user, mute } = await renderBar()

    act(() => mute.focus())
    await user.keyboard('{Enter}')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard(' ')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('mutes you when you deafen, and unmutes you again when you undeafen', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(deafen)
    expect(deafen).toHaveAttribute('aria-pressed', 'true')
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    await user.click(deafen)
    expect(deafen).toHaveAttribute('aria-pressed', 'false')
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps you muted after undeafening if you were muted before deafening', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(mute)
    await user.click(deafen)
    await user.click(deafen)

    expect(deafen).toHaveAttribute('aria-pressed', 'false')
    expect(mute).toHaveAttribute('aria-pressed', 'true')
  })

  it('undeafens when you unmute while deafened', async () => {
    const { user, mute, deafen } = await renderBar()

    await user.click(deafen)
    await user.click(mute)

    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(deafen).toHaveAttribute('aria-pressed', 'false')
  })
})
