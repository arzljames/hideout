import axios from 'axios'
import { env } from '@/lib/env'

/** Plain HTTP client for requests outside the typed hideout-api contract. */
export const http = axios.create({
  baseURL: env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})
