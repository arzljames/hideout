import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface JumpToLatestProps {
  /** New messages that arrived while scrolled up. */
  count: number
  onJump: () => void
  className?: string
}

/** "3 new messages · Jump to latest" pill, floating over the bottom of the message log. */
export function JumpToLatest({ count, onJump, className }: JumpToLatestProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      shape="round"
      onClick={onJump}
      className={cn('shadow-md motion-safe:animate-in motion-safe:fade-in-0', className)}
    >
      <ArrowDown aria-hidden="true" />
      {count === 1 ? '1 new message' : `${count} new messages`} · Jump to latest
    </Button>
  )
}
