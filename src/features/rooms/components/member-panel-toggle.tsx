import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetTrigger } from '@/components/ui/sheet'
import { useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMemberPanelStore } from '../member-panel-store'

/**
 * Shows or hides the member panel. From `md` up it toggles the inline panel (aria-pressed);
 * below `md` it's the trigger of RoomLayout's member Sheet, so Radix returns focus to it.
 * Must render inside RoomLayout.
 */
export function MemberPanelToggle() {
  const { isMobile } = useSidebar()
  const open = useMemberPanelStore((s) => s.open)
  const toggle = useMemberPanelStore((s) => s.toggle)

  if (isMobile) {
    return (
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Show members">
          <Users aria-hidden="true" />
        </Button>
      </SheetTrigger>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Constant label; aria-pressed says whether the panel is showing. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Show members"
          aria-pressed={open}
          onClick={toggle}
        >
          <Users aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{open ? 'Hide members' : 'Show members'}</TooltipContent>
    </Tooltip>
  )
}
