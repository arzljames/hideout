import type { Me } from '@/features/auth'

/** The signed-in user served by the default `GET /api/auth/me` handler. */
export const meFixture: Me = {
  id: '3f1c2b9a-7d4e-4c1a-9b2f-5e6d7a8b9c0d',
  steamId: '76561197960287930',
  displayName: 'Arzl',
  avatarUrl: null,
}
