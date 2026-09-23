import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ThemeToggle } from './theme-toggle'

const html = document.documentElement

describe('ThemeToggle', () => {
  it('defaults to the dark theme', async () => {
    renderWithProviders(<ThemeToggle />)

    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    expect(html).toHaveClass('dark')
  })

  it('switches to light and back to dark on click, persisting the choice', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />)

    await user.click(await screen.findByRole('button', { name: 'Switch to light theme' }))

    expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(html).toHaveClass('light')
    expect(html).not.toHaveClass('dark')
    expect(window.localStorage.getItem('hideout-theme')).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
    expect(html).toHaveClass('dark')
    expect(html).not.toHaveClass('light')
    expect(window.localStorage.getItem('hideout-theme')).toBe('dark')
  })

  it('restores a previously saved light theme', async () => {
    window.localStorage.setItem('hideout-theme', 'light')
    renderWithProviders(<ThemeToggle />)

    expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
    expect(html).toHaveClass('light')
  })

  it('toggles with the keyboard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />)
    const button = await screen.findByRole('button', { name: 'Switch to light theme' })

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toHaveFocus()
    expect(html).toHaveClass('light')
  })
})
