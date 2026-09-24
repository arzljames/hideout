import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

function renderShell() {
  // The shell reads route params and renders typed Links, so render the real route tree.
  return renderRoute('/')
}

describe('AppShell on desktop', () => {
  it('renders exactly one main landmark holding the page content', async () => {
    await renderShell()

    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    expect(mains[0]).toContainElement(screen.getByRole('heading', { level: 1, name: 'Home' }))
  })

  it('shows the Rooms rail with Home marked as the current page and a Create a room button', async () => {
    await renderShell()

    const rail = screen.getByRole('navigation', { name: 'Rooms' })
    // Home is a link now, and its name includes the pending invite count.
    expect(within(rail).getByRole('link', { name: 'Home, 3 pending invites' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(rail).getByRole('button', { name: 'Create a room' })).toBeInTheDocument()
  })

  it('lists Invites under Home sections', async () => {
    await renderShell()

    const sections = screen.getByRole('navigation', { name: 'Home sections' })
    // Invites is a link to the inbox now, named with its pending count.
    expect(within(sections).getByRole('link', { name: 'Invites 3 pending' })).toHaveAttribute(
      'href',
      '/invites',
    )
  })

  it('shows the signed-in user with presence and labelled account actions', async () => {
    await renderShell()

    expect(screen.getByText('Arzl')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('hides the avatar initial and presence dot from assistive technology', async () => {
    await renderShell()

    const initial = screen.getByText('A')
    expect(initial.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('img', { name: 'A' })).not.toBeInTheDocument()

    // The presence dot has no role or text, so locate it structurally inside the avatar.
    const avatar = initial.closest('[data-slot="avatar"]')
    const dot = avatar?.querySelector('[data-slot="avatar-badge"]')
    expect(dot).toBeInstanceOf(HTMLElement)
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })

  it('collapses with Ctrl+B, reveals the Open navigation trigger, and expands again from it', async () => {
    const user = userEvent.setup()
    await renderShell()

    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    // Visibility is CSS-driven (no stylesheet in jsdom), so assert the responsive class and the
    // sidebar's data-state, which is what the styles key off.
    expect(trigger).toHaveClass('md:hidden')
    const sidebar = screen
      .getByRole('navigation', { name: 'Rooms' })
      .closest('[data-slot="sidebar"]')
    expect(sidebar).toHaveAttribute('data-state', 'expanded')

    await user.keyboard('{Control>}b{/Control}')

    expect(sidebar).toHaveAttribute('data-state', 'collapsed')
    expect(screen.getByRole('button', { name: 'Open navigation' })).not.toHaveClass('md:hidden')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    expect(sidebar).toHaveAttribute('data-state', 'expanded')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveClass('md:hidden')
  })

  it('takes the collapsed sidebar out of the tab order', async () => {
    const user = userEvent.setup()
    await renderShell()

    await user.keyboard('{Control>}b{/Control}')
    await user.tab()

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveFocus()
  })
})

describe('AppShell on mobile', () => {
  let originalWidth: number

  beforeEach(() => {
    // useIsMobile reads window.innerWidth (< 768) after mount.
    originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalWidth,
    })
  })

  it('keeps the navigation closed until Open navigation is clicked', async () => {
    const user = userEvent.setup()
    await renderShell()

    expect(screen.queryByRole('navigation', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))

    const sheet = await screen.findByRole('dialog', { name: 'Navigation' })
    expect(sheet).toHaveAccessibleDescription('Rooms, invites and your account.')
    expect(within(sheet).getByRole('navigation', { name: 'Rooms' })).toBeInTheDocument()
    expect(within(sheet).getByRole('navigation', { name: 'Home sections' })).toBeInTheDocument()
  })

  // Opening the sheet focuses the rail's Home button; a tooltip there must not swallow Escape.
  it('closes the navigation sheet with a single Escape', async () => {
    const user = userEvent.setup()
    await renderShell()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await screen.findByRole('dialog', { name: 'Navigation' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  // SidebarTrigger isn't a Radix Sheet trigger, so the sidebar restores focus to it itself.
  it('returns focus to Open navigation when the sheet closes', async () => {
    const user = userEvent.setup()
    await renderShell()

    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    await user.click(trigger)
    await screen.findByRole('dialog', { name: 'Navigation' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
