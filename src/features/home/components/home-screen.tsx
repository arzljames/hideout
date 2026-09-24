import { AppHeader } from '@/features/shell'
import { cn } from '@/lib/utils'
import { HomeEmptyState } from './home-empty-state'

interface HomeScreenProps {
  className?: string
}

/** Home page content, rendered inside the app shell's main area. */
export function HomeScreen({ className }: HomeScreenProps) {
  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <AppHeader title="Home" />
      {/* TODO(api): show the room list from the rooms query; keep this as its empty state. */}
      <HomeEmptyState />
    </div>
  )
}
