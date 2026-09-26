// Pin hideout-api's Realtime event contract to src/lib/realtime/events.schema.json.
// Usage: npm run gen:events   (EVENTS_CONTRACT_URL overrides the default local API)
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const url = process.env.EVENTS_CONTRACT_URL ?? 'http://localhost:3001/api/contract/events.schema.json'
const out = fileURLToPath(new URL('../src/lib/realtime/events.schema.json', import.meta.url))

const response = await fetch(url)
if (!response.ok) {
  console.error(`Failed to download ${url}: HTTP ${response.status}`)
  process.exit(1)
}
const schema = await response.json()
if (typeof schema !== 'object' || schema === null || !('serverEvents' in schema)) {
  console.error(`${url} is not the Realtime event contract (no "serverEvents").`)
  process.exit(1)
}
await writeFile(out, `${JSON.stringify(schema, null, 2)}\n`)
console.log(`Wrote ${out}`)
