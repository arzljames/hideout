import type { Member, Role } from './types'

export interface MemberGroup {
  role: Role
  title: string
  members: Member[]
}

const GROUPS: { role: Role; title: string }[] = [
  { role: 'owner', title: 'Owner' },
  { role: 'admin', title: 'Admins' },
  { role: 'member', title: 'Members' },
]

/** Members split into Owner / Admins / Members, keeping the API's order within each group. */
export function groupMembersByRole(members: Member[]): MemberGroup[] {
  return GROUPS.map(({ role, title }) => ({
    role,
    title,
    members: members.filter((member) => member.role === role),
  }))
}
