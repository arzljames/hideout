import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { meQueryOptions } from '../api'

/**
 * For the authenticated layout: if a background refetch finds the session gone (`me` becomes
 * `null`), re-run the route guards, which redirect to /sign-in.
 */
export function useSessionGuard() {
  const router = useRouter()
  const { data } = useQuery(meQueryOptions)

  useEffect(() => {
    if (data === null) void router.invalidate()
  }, [data, router])
}
