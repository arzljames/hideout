import { Keyboard } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

interface PushToTalkPanelProps {
  className?: string
}

/** Current push-to-talk key and a way to change it. Only shown in push-to-talk mode. */
export function PushToTalkPanel({ className }: PushToTalkPanelProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex items-center gap-3 rounded-lg border border-border p-3', className)}
    >
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="text-sm font-medium">
          Push-to-talk key
        </h3>
        <p className="text-xs text-muted-foreground">
          Hold it to talk. Works while Hideout is the active tab.
        </p>
      </div>
      {/* TODO(livekit): read the bound key from settings. */}
      <Kbd>V</Kbd>
      {/* TODO(voice): capture a new key. */}
      <Button type="button" variant="outline" size="sm">
        <Keyboard aria-hidden="true" />
        Change key
      </Button>
    </section>
  )
}
