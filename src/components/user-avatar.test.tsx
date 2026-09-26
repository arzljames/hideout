import { render, screen } from '@testing-library/react'
import { UserAvatar } from './user-avatar'

/**
 * jsdom never loads images, so Radix Avatar would never show one. Radix probes loading with
 * `new window.Image()` and reads `complete`/`naturalWidth`; stand in an image that has already
 * loaded (or failed) to exercise both outcomes.
 */
function stubImageLoad(outcome: 'loaded' | 'error') {
  class StubImage extends EventTarget {
    src = ''
    referrerPolicy = ''
    crossOrigin: string | null = null
    readonly complete = true
    readonly naturalWidth = outcome === 'loaded' ? 64 : 0
  }
  vi.stubGlobal('Image', StubImage)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UserAvatar', () => {
  it('shows the first letter of the name, hidden from assistive tech, when there is no image', () => {
    const { container } = render(<UserAvatar name="arzl" src={null} />)

    const initial = screen.getByText('A')
    expect(initial.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows the profile image as decorative, without sending a referrer to the image host', () => {
    stubImageLoad('loaded')

    const { container } = render(
      <UserAvatar name="Arzl" src="https://avatars.steamstatic.test/arzl.jpg" />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://avatars.steamstatic.test/arzl.jpg')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
    // Decorative: nothing named for assistive tech, the name is rendered next to the avatar.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('falls back to the initial when the image fails to load', () => {
    stubImageLoad('error')

    const { container } = render(
      <UserAvatar name="Arzl" src="https://avatars.steamstatic.test/broken.jpg" />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('keeps emoji initials whole', () => {
    render(<UserAvatar name="🦊 Fox" />)

    expect(screen.getByText('🦊')).toBeInTheDocument()
  })
})
