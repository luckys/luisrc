import { startLab } from './lab.mjs'
import { startDestinations, fixedResolver } from './destinations.mjs'
import { createImporter } from './importer.mjs'
const destinations = await startDestinations()
let lab
try {
  lab = await startLab({
    importer: createImporter({ ...destinations, resolve: fixedResolver().resolve }),
  })
} catch (error) {
  await destinations.close()
  throw error
}
console.log(`API multi-tenant intencionadamente vulnerable: ${lab.origin}`)
console.log(`Proveedor ficticio (resolver local): ${destinations.providerOrigin}`)
console.log(`Servicio interno ficticio: ${destinations.internalOrigin}`)
console.log(
  'Usar solo loopback. No publicar ni abrir túneles. Ctrl+C cierra los tres servidores.',
)
let closing = false
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (closing) return
    closing = true
    await lab.close()
    await destinations.close()
  })
