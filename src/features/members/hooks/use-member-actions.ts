import { useCallback, useState } from 'react'
import type { Member } from '@/features/rooms'
import { useChangeRole } from '../api'
import type { MemberMenuAction } from '../member-menu-entries'

/** A confirmation to show: remove or transfer, for one member. */
export interface MemberActionRequest {
  action: 'remove' | 'transfer'
  member: Member
  /** Focus target when the confirmation closes (the control that opened it). */
  returnFocus: HTMLElement | null
  /** New per request, so each opening starts without an earlier failure. */
  key: number
}

let nextKey = 0

/**
 * Runs member menu actions for a room: role changes go straight to the API (toasted); remove
 * and transfer open a confirmation (render `MemberActionDialogs` with this state).
 */
export function useMemberActions(roomId: string) {
  const changeRole = useChangeRole(roomId)
  const { isPending: changingRole, mutate: changeRoleMutate } = changeRole
  const [request, setRequest] = useState<MemberActionRequest | null>(null)
  const [open, setOpen] = useState(false)

  const run = useCallback(
    (member: Member, action: MemberMenuAction, returnFocus: HTMLElement | null) => {
      if (action === 'make-admin' || action === 'remove-admin') {
        // One role change at a time; after a 5xx it stays pending until the room is refetched.
        if (changingRole) return
        changeRoleMutate({ member, role: action === 'make-admin' ? 'admin' : 'member' })
        return
      }
      nextKey += 1
      setRequest({ action, member, returnFocus, key: nextKey })
      setOpen(true)
    },
    [changingRole, changeRoleMutate],
  )

  return { run, request, open, setOpen, changingRole }
}
