import createClient from 'openapi-fetch'
import { env } from '@/lib/env'
import type { paths } from './schema.gen'

/** Typed client for hideout-api, generated from its OpenAPI contract. */
export const api = createClient<paths>({ baseUrl: env.VITE_API_URL })
