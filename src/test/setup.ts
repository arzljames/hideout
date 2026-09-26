import '@testing-library/jest-dom/vitest'
import './polyfills'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { resetPendingInvitesStore } from '@/features/invites/pending-invites-store'
import { resetMemberPanelStore } from '@/features/rooms/member-panel-store'
import { resetVoiceStore } from '@/features/voice/voice-store'
import { setUnauthenticatedHandler } from '@/lib/api/client'
import { setRealtimeSignedOutHandler, stopRealtime } from '@/lib/realtime/connection'
import { useVoiceSession } from '@/stores/voice-session'
import { fakeSupabase } from './fake-supabase'
import { server } from './msw/server'

// No test talks to Supabase: Realtime runs against a fake client (see fake-supabase.ts).
vi.mock('@/lib/supabase', async () => {
  const { fakeSupabase } = await import('./fake-supabase')
  return { supabase: fakeSupabase }
})

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
  // Zustand stores are module singletons; start every test from their initial state.
  resetVoiceStore()
  resetMemberPanelStore()
  useVoiceSession.getState().leave()
  // renderRoute registers a handler bound to that test's router and QueryClient.
  setUnauthenticatedHandler(undefined)
  setRealtimeSignedOutHandler(undefined)
  resetPendingInvitesStore()
  // Realtime is a module singleton too (token manager, topics, the fake client's channels).
  stopRealtime()
  fakeSupabase.reset()
  // sonner's toast state is a module singleton and replays still-active toasts to a newly
  // mounted <Toaster />, so a toast from one test would otherwise show up in the next.
  toast.dismiss()
})
afterAll(() => server.close())
