import { sameRoomId, type Member, type Role } from '@/features/rooms'

export interface MemberPermissions {
  /** Make admin / Remove admin. */
  canChangeRole: boolean
  /** Remove from room. */
  canRemove: boolean
  /** Transfer ownership to them. */
  canTransfer: boolean
}

const NONE: MemberPermissions = { canChangeRole: false, canRemove: false, canTransfer: false }

/**
 * What the signed-in user (`myRole`, `meId`) may do to `target` (design rule; hideout-api
 * decides and enforces every one):
 * - nobody acts on themself (leaving is its own action) or on the owner;
 * - the owner changes roles, removes, and transfers ownership to anyone else;
 * - an admin removes plain members only;
 * - plain members manage nobody.
 */
export function memberActions(
  myRole: Role,
  target: Pick<Member, 'role' | 'user'>,
  meId: string | undefined,
): MemberPermissions {
  if (meId === undefined || sameRoomId(target.user.id, meId) || target.role === 'owner') {
    return NONE
  }
  if (myRole === 'owner') return { canChangeRole: true, canRemove: true, canTransfer: true }
  if (myRole === 'admin' && target.role === 'member') return { ...NONE, canRemove: true }
  return NONE
}

export function hasAnyAction(permissions: MemberPermissions): boolean {
  return permissions.canChangeRole || permissions.canRemove || permissions.canTransfer
}
