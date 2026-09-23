import '@testing-library/jest-dom/vitest'
import './polyfills'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'

function resetThemeState() {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetThemeState())
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
