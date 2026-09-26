import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsSectionHeaderProps {
  /** The page's h1. */
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Title row of a settings section: h1, optional muted line, optional actions on the right. */
export function SettingsSectionHeader({
  title,
  description,
  actions,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
