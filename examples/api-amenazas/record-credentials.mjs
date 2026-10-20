import { writeFile } from 'node:fs/promises'
import { observeRotation } from './observe-credentials.mjs'
await writeFile(
  new URL('./credential-evidence.json', import.meta.url),
  JSON.stringify(await observeRotation(), null, 2) + '\n',
)
