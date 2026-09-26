import { authErrorMessage, authErrorSearchSchema } from './auth-errors'

describe('authErrorMessage', () => {
  it.each([
    ['STEAM_LOGIN_FAILED', "Steam sign-in didn't go through. Please try again."],
    ['LOGIN_STATE_MISMATCH', 'That sign-in link expired. Please sign in again.'],
    ['STEAM_UNAVAILABLE', "Steam isn't responding right now. Try again in a moment."],
    ['LOGIN_FAILED', 'Something went wrong on our side. Please try again.'],
    ['RATE_LIMITED', 'Too many sign-in attempts. Wait a minute and try again.'],
  ])('explains %s', (code, message) => {
    expect(authErrorMessage(code)).toBe(message)
  })

  it.each(['NEW_CODE', 'toString', 'constructor', '__proto__', ''])(
    'uses the generic message for an unknown code (%j)',
    (code) => {
      expect(authErrorMessage(code)).toBe("Sign-in didn't work. Please try again.")
    },
  )
})

describe('authErrorSearchSchema', () => {
  it('keeps a code-shaped value, including codes this build does not know yet', () => {
    expect(authErrorSearchSchema.parse({ auth_error: 'RATE_LIMITED' })).toEqual({
      auth_error: 'RATE_LIMITED',
    })
    expect(authErrorSearchSchema.parse({ auth_error: 'NEW_CODE_2' })).toEqual({
      auth_error: 'NEW_CODE_2',
    })
  })

  it('treats a missing param as no error', () => {
    expect(authErrorSearchSchema.parse({})).toEqual({ auth_error: undefined })
  })

  it.each([
    ['lowercase', 'rate_limited'],
    ['too long', `A${'B'.repeat(64)}`],
    ['script-ish', '<script>alert(1)</script>'],
    ['with spaces', 'RATE LIMITED'],
    ['starting with a digit', '1RATE'],
    ['empty', ''],
    ['a number', 42],
    ['an array', ['RATE_LIMITED']],
  ])('drops a %s value instead of failing the route', (_label, value) => {
    expect(authErrorSearchSchema.parse({ auth_error: value })).toEqual({ auth_error: undefined })
  })

  it('accepts the longest allowed code (64 characters)', () => {
    const code = `A${'B'.repeat(63)}`
    expect(authErrorSearchSchema.parse({ auth_error: code })).toEqual({ auth_error: code })
  })
})
