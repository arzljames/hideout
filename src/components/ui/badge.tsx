import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        /** Primary-tinted label (e.g. Owner role, Speaking). */
        soft: "bg-primary/15 text-primary dark:bg-primary/20",
        /** Quiet neutral label (e.g. Admin role). */
        subtle: "bg-muted text-muted-foreground",
        /** Small solid count (e.g. pending invites next to a nav item). */
        count:
          "h-4 min-w-4 rounded-full bg-primary px-1 text-[0.625rem] leading-none text-primary-foreground tabular-nums",
      },
      /** Pinned over a rail tile: a ring in the rail color cuts it out of the tile. */
      pinned: {
        true: "ring-2 ring-sidebar-rail",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      pinned: false,
    },
  }
)

// forwardRef: React 18 drops `ref` on function components; Radix `asChild` triggers need it.
const Badge = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span"> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean }
>(function Badge(
  { className, variant = "default", pinned = false, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      ref={ref}
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, pinned }), className)}
      {...props}
    />
  )
})

export { Badge, badgeVariants }
