import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { TopBar } from './top-bar'

describe('TopBar', () => {
  it('shows the brand, theme toggle and signed-in user inside the banner landmark', async () => {
    renderWithProviders(<TopBar user={{ name: 'Arzl', tone: 'persona-3' }} />)

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Hideout')).toBeInTheDocument()
    expect(within(banner).getByText('Arzl')).toBeInTheDocument()
    expect(
      await within(banner).findByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument()
  })

  it("doesn't announce the signed-in user's own presence dot", () => {
    renderWithProviders(<TopBar user={{ name: 'Arzl' }} />)

    const banner = screen.getByRole('banner')
    expect(within(banner).queryByText(/online/i)).toBeNull()
    expect(banner.querySelector('[data-status="online"]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps emoji-leading names whole in the avatar initial', () => {
    renderWithProviders(<TopBar user={{ name: '🐉Jonas' }} />)

    expect(screen.getByText('🐉').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('hides the decorative avatar initial from assistive technology', () => {
    renderWithProviders(<TopBar user={{ name: 'arzl' }} />)

    // Initial is derived from the name and upper-cased.
    expect(screen.getByText('A').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
