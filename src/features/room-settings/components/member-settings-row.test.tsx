import { vi } from 'vitest'
import { failOnConsoleError } from '@/test/console-guard'

failOnConsoleError()

/**
 * Render a member row with the process in `timeZone`. The row's Intl.DateTimeFormat is created
 * at module load, so the module (and RTL/React with it) is re-imported after switching TZ.
 */
async function joinedTextIn(timeZone: string, joinedAt: string) {
  // stubEnv writes process.env.TZ, which Node applies to Date and Intl immediately.
  vi.stubEnv('TZ', timeZone)
  vi.resetModules()
  try {
    const { render, screen } = await import('@testing-library/react')
    const { MemberSettingsRow } = await import('./member-settings-row')
    const { unmount } = render(
      <ul>
        <MemberSettingsRow
          member={{
            roomId: 'a0000000-0000-4000-8000-000000000001',
            user: { id: 'e0000000-0000-4000-8000-000000000005', displayName: 'Theo', avatarUrl: null },
            role: 'member',
            joinedAt,
            currentGame: null,
          }}
          isViewer={false}
        />
      </ul>,
    )
    const text = screen.getByText(/^Joined/).textContent
    // This RTL instance isn't the one setup.ts cleans up, so unmount here.
    unmount()
    return text
  } finally {
    vi.unstubAllEnvs()
    vi.resetModules()
  }
}

describe('MemberSettingsRow join date', () => {
  it('shows the join month in a timezone east of UTC', async () => {
    expect(await joinedTextIn('Asia/Manila', '2026-09-15T12:00:00.000Z')).toBe('Joined Sep 2026')
  })

  it('shows the join month in a timezone west of UTC', async () => {
    expect(await joinedTextIn('America/Los_Angeles', '2026-09-15T12:00:00.000Z')).toBe(
      'Joined Sep 2026',
    )
  })

  // joinedAt is a full timestamp, so the month is the one where the viewer lives.
  it("uses the viewer's local month near a month boundary", async () => {
    expect(await joinedTextIn('America/Los_Angeles', '2026-09-01T03:00:00.000Z')).toBe(
      'Joined Aug 2026',
    )
    expect(await joinedTextIn('Asia/Manila', '2026-08-31T20:00:00.000Z')).toBe('Joined Sep 2026')
  })
})
