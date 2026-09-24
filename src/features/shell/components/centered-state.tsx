import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const centeredStateIconVariants = cva(
  'flex size-12 items-center justify-center rounded-xl bg-muted [&_svg]:size-5',
  {
    variants: {
      tone: {
        primary: 'text-primary',
        muted: 'text-muted-foreground',
        destructive: 'text-destructive',
      },
    },
    defaultVariants: {
      tone: 'primary',
    },
  },
)

interface CenteredStateProps
  extends Omit<ComponentProps<'section'>, 'title'>,
    VariantProps<typeof centeredStateIconVariants> {
  /** Decorative icon; give it `aria-hidden`. */
  icon: ReactNode
  title: string
  description: ReactNode
  /** Buttons or links, stacked below the description. */
  actions?: ReactNode
}

/** Centered empty/error message for the main area: icon tile, h2, description, actions. */
export function CenteredState({
  icon,
  title,
  description,
  actions,
  tone,
  className,
  ...props
}: CenteredStateProps) {
  return (
    <section
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-4 py-12 text-center',
        className,
      )}
      {...props}
    >
      <div className={centeredStateIconVariants({ tone })}>{icon}</div>
      <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-balance text-muted-foreground">{description}</p>
      {actions && <div className="mt-6 flex flex-col items-center gap-3">{actions}</div>}
    </section>
  )
}
