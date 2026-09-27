import { Crown, ShieldCheck, ShieldOff, UserMinus, type LucideIcon } from 'lucide-react'
import type { Member } from '@/features/rooms'
import type { MemberPermissions } from './permissions'

export type MemberMenuAction = 'make-admin' | 'remove-admin' | 'transfer' | 'remove'

export interface MemberMenuEntry {
  action: MemberMenuAction
  label: string
  icon: LucideIcon
  destructive: boolean
  /** Draw a separator above this entry. */
  separated: boolean
}

/**
 * The items a member's menus show, in order, for what the viewer may do. Shared by the … menu
 * and the context menu so they never disagree. `include` drops actions a surface offers
 * elsewhere (Room settings has Transfer ownership in its Danger zone).
 */
export function memberMenuEntries(
  member: Pick<Member, 'role'>,
  permissions: MemberPermissions,
  include: { transfer?: boolean } = {},
): MemberMenuEntry[] {
  const entries: MemberMenuEntry[] = []
  if (permissions.canChangeRole) {
    entries.push(
      member.role === 'admin'
        ? { action: 'remove-admin', label: 'Remove admin', icon: ShieldOff, destructive: false, separated: false }
        : { action: 'make-admin', label: 'Make admin', icon: ShieldCheck, destructive: false, separated: false },
    )
  }
  if (permissions.canTransfer && include.transfer !== false) {
    entries.push({ action: 'transfer', label: 'Transfer ownership', icon: Crown, destructive: false, separated: false })
  }
  if (permissions.canRemove) {
    entries.push({
      action: 'remove',
      label: 'Remove from room',
      icon: UserMinus,
      destructive: true,
      separated: entries.length > 0,
    })
  }
  return entries
}
