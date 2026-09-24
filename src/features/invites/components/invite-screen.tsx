import { TopBar } from '@/components/top-bar'
import { cn } from '@/lib/utils'
import { sampleInvite, sampleViewer } from '../sample-invite'
import { InviteCard } from './invite-card'

interface InviteScreenProps {
  className?: string
}

export function InviteScreen({ className }: InviteScreenProps) {
  return (
    <div className={cn('flex min-h-svh flex-col', className)}>
      <TopBar user={sampleViewer} />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <InviteCard invite={sampleInvite} className="w-full max-w-sm" />
      </main>
    </div>
  )
}
