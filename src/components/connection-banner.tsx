import { WifiOff } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ConnectionBannerProps {
  /** e.g. "Reconnecting…" or "Live updates paused". */
  title: string
  /** What's affected and what to do, e.g. "New messages will appear when you're back online." */
  description?: string
  className?: string
}

/**
 * A persistent connection problem (Realtime or voice), announced politely: it's status, not an
 * interruption. Render it only while the problem lasts.
 */
export function ConnectionBanner({ title, description, className }: ConnectionBannerProps) {
  return (
    <Alert role="status" aria-live="polite" className={className}>
      <WifiOff aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  )
}
