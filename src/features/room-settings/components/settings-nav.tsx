import { Link } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { SETTINGS_SECTIONS, type SettingsSection } from '../settings-sections'

const settingsNavItemVariants = cva(
  'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-sidebar-foreground/80 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      active: {
        true: 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        false: '',
      },
    },
  },
)

interface SettingsNavProps {
  roomId: string
  section: SettingsSection
  /** Vertical in the desktop sidebar; a horizontally scrolling row below `md`. */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/** Section links for Room settings. The current section carries aria-current="page". */
export function SettingsNav({
  roomId,
  section,
  orientation = 'vertical',
  className,
}: SettingsNavProps) {
  return (
    <nav aria-label="Room settings sections" className={cn(className)}>
      <ul
        role="list"
        className={cn(
          'flex gap-1',
          // py-1 leaves room for focus rings inside the scrolling row.
          orientation === 'vertical' ? 'flex-col' : 'overflow-x-auto px-4 py-1 pb-2',
        )}
      >
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = id === section
          return (
            <li key={id} className="shrink-0">
              <Link
                to="/rooms/$roomId/settings"
                params={{ roomId }}
                search={{ section: id }}
                // aria-current comes from the validated `section`, not the Link's own active
                // matching, so /settings with no ?section still marks Overview as current.
                aria-current={active ? 'page' : undefined}
                className={settingsNavItemVariants({ active })}
              >
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
