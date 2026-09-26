// TODO(api): roomInvitesQueryOptions, a separate owner/admin-only endpoint; invite codes are
// bearer credentials, never part of the room payload.

/** An active invite link, as Room settings lists it. */
export interface RoomInviteLink {
  code: string
  createdBy: string
  uses: number
  /** null = no limit. */
  maxUses: number | null
  /** Relative time left, e.g. "5 hours"; null = never expires. TODO(api): an ISO expiresAt. */
  expiresIn: string | null
}

const sampleInviteLinks: Record<string, RoomInviteLink[]> = {
  'night-owls': [
    { code: '7Hq2xK', createdBy: 'Maya', uses: 3, maxUses: 10, expiresIn: '5 hours' },
    { code: 'p4LmZw', createdBy: 'Arzl', uses: 12, maxUses: null, expiresIn: null },
  ],
  'raid-night': [{ code: 'R41dNt', createdBy: 'Theo', uses: 1, maxUses: 5, expiresIn: '1 day' }],
}

export function getSampleInviteLinks(roomId: string): RoomInviteLink[] {
  return sampleInviteLinks[roomId] ?? []
}
