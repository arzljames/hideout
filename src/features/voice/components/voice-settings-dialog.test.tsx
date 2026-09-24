import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

async function openSettings() {
  const user = userEvent.setup()
  await renderRoute('/rooms/night-owls/general')
  const trigger = screen.getByRole('button', { name: 'Voice settings' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'Voice settings' })
  return { user, trigger, dialog }
}

describe('VoiceSettingsDialog', () => {
  it("opens from the voice bar's settings button with a description", async () => {
    const { dialog } = await openSettings()

    expect(dialog).toHaveAccessibleDescription(
      'Choose your microphone and speakers, input volume and how your mic opens.',
    )
  })

  it('changes the input device', async () => {
    const { user, dialog } = await openSettings()

    const input = within(dialog).getByRole('combobox', { name: 'Input device' })
    expect(input).toHaveTextContent('Default microphone')

    await user.click(input)
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getAllByRole('option')).toHaveLength(4)
    await user.click(within(listbox).getByRole('option', { name: 'Headset mic' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveTextContent('Headset mic')
    // Closing the select keeps the dialog open.
    expect(screen.getByRole('dialog', { name: 'Voice settings' })).toBeInTheDocument()
  })

  it('changes the output device', async () => {
    const { user, dialog } = await openSettings()

    const output = within(dialog).getByRole('combobox', { name: 'Output device' })
    expect(output).toHaveTextContent('Default speakers')

    await user.click(output)
    await user.click(await screen.findByRole('option', { name: 'Monitor speakers' }))

    expect(output).toHaveTextContent('Monitor speakers')
  })

  it('keeps the chosen devices after closing and reopening', async () => {
    const { user, trigger, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('combobox', { name: 'Input device' }))
    await user.click(await screen.findByRole('option', { name: 'USB condenser mic' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await user.click(trigger)

    const reopened = await screen.findByRole('dialog', { name: 'Voice settings' })
    expect(within(reopened).getByRole('combobox', { name: 'Input device' })).toHaveTextContent(
      'USB condenser mic',
    )
  })

  it('adjusts input volume with the arrow keys and shows the new percentage', async () => {
    const { user, dialog } = await openSettings()

    const slider = within(dialog).getByRole('slider', { name: 'Input volume' })
    expect(slider).toHaveAttribute('aria-valuenow', '80')
    expect(slider).toHaveAttribute('aria-valuetext', '80%')
    expect(within(dialog).getByText('80%')).toBeInTheDocument()

    // Clicking the slider in jsdom jumps to 0 (no layout), so focus it directly.
    act(() => slider.focus())
    await user.keyboard('{ArrowRight}{ArrowRight}')

    expect(slider).toHaveAttribute('aria-valuetext', '82%')
    expect(within(dialog).getByText('82%')).toBeInTheDocument()

    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')

    expect(slider).toHaveAttribute('aria-valuenow', '79')
    expect(within(dialog).getByText('79%')).toBeInTheDocument()
  })

  it('stops the volume at 100% and 0%', async () => {
    const { user, dialog } = await openSettings()

    const slider = within(dialog).getByRole('slider', { name: 'Input volume' })
    act(() => slider.focus())
    await user.keyboard('{End}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')

    await user.keyboard('{Home}{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuetext', '0%')
  })

  it('shows the push-to-talk key only in push-to-talk mode', async () => {
    const { user, dialog } = await openSettings()

    const modes = within(dialog).getByRole('radiogroup', { name: 'Input mode' })
    expect(within(modes).getByRole('radio', { name: /Push to talk/ })).toBeChecked()
    expect(within(dialog).getByRole('region', { name: 'Push-to-talk key' })).toBeInTheDocument()

    await user.click(within(modes).getByRole('radio', { name: /Voice activity/ }))

    expect(within(modes).getByRole('radio', { name: /Voice activity/ })).toBeChecked()
    expect(within(dialog).queryByRole('region', { name: 'Push-to-talk key' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Push-to-talk key')).not.toBeInTheDocument()

    await user.click(within(modes).getByRole('radio', { name: /Push to talk/ }))

    expect(within(dialog).getByRole('region', { name: 'Push-to-talk key' })).toBeInTheDocument()
  })

  it('closes on Done and returns focus to the settings button', async () => {
    const { user, trigger, dialog } = await openSettings()

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and returns focus to the settings button', async () => {
    const { user, trigger } = await openSettings()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Voice settings' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('describes the volume slider with the mic test caption', async () => {
    const { dialog } = await openSettings()

    expect(within(dialog).getByRole('slider', { name: 'Input volume' })).toHaveAccessibleDescription(
      'Talk to test your mic. The bar lights up when Hideout hears you.',
    )
  })

  it('lists the mute and deafen shortcuts with Ctrl off Apple platforms', async () => {
    const { dialog } = await openSettings()

    const shortcuts = within(dialog).getByText('Shortcuts:').closest('p')
    expect(shortcuts).toHaveTextContent('Mute Ctrl+Shift+M')
    expect(shortcuts).toHaveTextContent('Deafen Ctrl+Shift+D')
  })

  it('shows ⌘ for the shortcuts on macOS', async () => {
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    try {
      const { dialog } = await openSettings()

      const shortcuts = within(dialog).getByText('Shortcuts:').closest('p')
      expect(shortcuts).toHaveTextContent('⌘')
      expect(shortcuts).not.toHaveTextContent('Ctrl')
    } finally {
      platform.mockRestore()
    }
  })
})
