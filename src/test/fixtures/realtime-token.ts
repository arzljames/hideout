import { meFixture } from './me'

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** An unsigned JWT-shaped token for `sub` (the client only reads `sub`; it never verifies). */
export function fakeRealtimeJwt(sub: string, claims: Record<string, unknown> = {}): string {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub, ...claims })}.signature`
}

/** The token the default `GET /api/auth/realtime-token` handler serves (for `meFixture`). */
export const testRealtimeToken = fakeRealtimeJwt(meFixture.id, { jti: 'test' })
