import { cn } from '@/lib/utils'

interface DayDividerProps {
  label: string
  className?: string
}

/** Horizontal rule with a centered day label ("Today"). */
export function DayDivider({ label, className }: DayDividerProps) {
  return (
    <div role="separator" aria-label={label} className={cn('flex items-center gap-3 px-4 py-2', className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  )
}
