import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>

/**
 * Class-based light/dark/system theming, persisted in localStorage.
 * The pre-paint script in index.html mirrors `storageKey` and `defaultTheme`; change both together.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="hideout-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
