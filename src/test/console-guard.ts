import { vi, type MockInstance } from 'vitest'

/**
 * Fail the test if React (or anything else) logs through console.error, e.g.
 * "Function components cannot be given refs" or missing DialogTitle warnings.
 * Call once at the top level of a test file.
 */
export function failOnConsoleError() {
  let spy: MockInstance<typeof console.error>

  beforeEach(() => {
    spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    const calls = spy.mock.calls.map((args) => args.map(String).join(' '))
    spy.mockRestore()
    expect(calls, 'console.error was called').toEqual([])
  })
}
