import { startLab } from './lab.mjs'
const lab = await startLab()
console.log(`Sandbox intencionadamente vulnerable, solo loopback: ${lab.origin}`)
console.log('Fixtures públicos: Bearer demo-alice (north), Bearer demo-bob (south).')
console.log('No publicar ni abrir un túnel. Ctrl+C para cerrar y borrar la base efímera.')
let closing = false
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (closing) return
    closing = true
    await lab.close()
  })
