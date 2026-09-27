import { Pencil, Trash2 } from 'lucide-react'
import { forwardRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MessageActionsProps {
  /** Omit to hide Edit (not your message). */
  onEdit?: () => void
  /** Omit to hide Delete. */
  onDelete?: () => void
  /** Escape or ArrowLeft past the first button: hand focus back to the message row. */
  onExit: () => void
  className?: string
}

/**
 * Hover/focus toolbar for a message you can edit or delete. Its buttons are outside the tab
 * order (the message log is one roving tab stop); from a focused row, ArrowRight enters the
 * toolbar, and ArrowLeft/ArrowRight move between its buttons.
 */
export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
  function MessageActions({ onEdit, onDelete, onExit, className }, ref) {
    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
      const index = buttons.indexOf(event.target as HTMLButtonElement)
      if (index === -1) return

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        buttons[Math.min(index + 1, buttons.length - 1)]?.focus()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (index === 0) onExit()
        else buttons[index - 1]?.focus()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Message actions"
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-sm',
          className,
        )}
      >
        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                aria-label="Edit message"
                onClick={onEdit}
              >
                <Pencil aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Edit</TooltipContent>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                aria-label="Delete message"
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  },
)
