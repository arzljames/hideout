import { screen } from '@testing-library/react'
import { failOnConsoleError } from '@/test/console-guard'
import { renderRoute } from '@/test/render'

failOnConsoleError()

function renderHome() {
  // HomeScreen renders inside the shell, which needs the router, so render the "/" route.
  return renderRoute('/')
}

describe('HomeScreen', () => {
  it('titles the page "Home" with a single h1', async () => {
    await renderHome()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
  })

  it('explains that rooms are private in the empty state', async () => {
    await renderHome()

    expect(screen.getByRole('heading', { level: 2, name: 'Rooms are private' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Nobody can find a room without an invite from someone inside it. Create one for your squad, or paste an invite link you were sent.',
      ),
    ).toBeInTheDocument()
  })

  it('offers to create a room or paste an invite link from the main area', async () => {
    await renderHome()

    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Rooms are private' }))
    // The rail has its own "Create a room" button, so scope to the empty state's section.
    const createButtons = screen.getAllByRole('button', { name: 'Create a room' })
    expect(createButtons.filter((button) => main.contains(button))).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Have an invite link? Paste it here' }),
    ).toBeInTheDocument()
  })
})
