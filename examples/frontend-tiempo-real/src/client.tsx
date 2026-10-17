import { createRoot, hydrateRoot } from 'react-dom/client'
import { App, type View } from './App.tsx'
import type { Order } from './state.ts'

const root = document.getElementById('root')!
const data = JSON.parse(document.getElementById('boot')!.textContent!) as {
  view: View
  seed: Order
  mode: string
}
const app = <App view={data.view} seed={data.seed} />
if (data.mode === 'ssr') hydrateRoot(root, app)
else createRoot(root).render(app)
