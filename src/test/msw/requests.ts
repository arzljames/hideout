import { http } from 'msw'
import { server } from './server'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

async function readBody(request: Request): Promise<unknown> {
  const text = await request.clone().text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Record requests to `method path` (JSON bodies, in order) and pass them on to the handlers
 * already installed (defaults or earlier `server.use` overrides).
 */
export function recordRequests(method: Method, path: string) {
  const bodies: unknown[] = []
  server.use(
    http[method](path, async ({ request }) => {
      bodies.push(await readBody(request))
      return undefined
    }),
  )
  return {
    bodies,
    get count() {
      return bodies.length
    },
  }
}

/**
 * Hold requests to `method path` until released; each then falls through to the handlers
 * already installed. `waiting` is how many are held right now (i.e. in flight).
 */
export function gateRequests(method: Method, path: string) {
  const bodies: unknown[] = []
  const waiting: (() => void)[] = []
  let open = false
  let maxWaiting = 0
  server.use(
    http[method](path, async ({ request }) => {
      bodies.push(await readBody(request))
      if (!open) {
        await new Promise<void>((resolve) => {
          waiting.push(resolve)
          maxWaiting = Math.max(maxWaiting, waiting.length)
        })
      }
      return undefined
    }),
  )
  return {
    bodies,
    get count() {
      return bodies.length
    },
    /** Requests held right now. */
    get waiting() {
      return waiting.length
    },
    /** The most requests ever held at once. */
    get maxWaiting() {
      return maxWaiting
    },
    releaseNext() {
      waiting.shift()?.()
    },
    releaseAll() {
      open = true
      waiting.splice(0).forEach((resolve) => resolve())
    },
  }
}
