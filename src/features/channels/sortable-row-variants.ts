import { cva } from 'class-variance-authority'

/**
 * A sortable channel row (the element getting `SortableChannelItem.setRowElement`): lifted
 * while dragged (`data-dragging`), and under reduced motion no animated settling (the drag
 * transform itself still applies). `surface` matches the background the row sits on.
 */
export const sortableRowVariants = cva(
  'motion-reduce:transition-none! data-dragging:relative data-dragging:z-10 data-dragging:shadow-md',
  {
    variants: {
      surface: {
        sidebar: 'rounded-md data-dragging:bg-sidebar',
        page: 'data-dragging:bg-background',
      },
    },
    defaultVariants: { surface: 'page' },
  },
)
