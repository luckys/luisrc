import { startLab } from './lab.mjs'
import { createAdmission } from './admission.mjs'
import { startDestinations, fixedResolver } from './destinations.mjs'
import { createImporter } from './importer.mjs'
const destinations = await startDestinations()
let lab
try {
  lab = await startLab({
    importer: createImporter({ ...destinations, resolve: fixedResolver().resolve }),
    admission: createAdmission(),
  })
} catch (error) {
  await destinations.close()
  throw error
}
console.log(`API local con admisión: ${lab.origin}`)
console.log(
  'Solo loopback y fixtures públicos. POST /tenants/north/imports con reference a1.',
)
console.log(
  'North/South: un trabajo activo por tenant, dos globales; burst 4, recarga 1/s.',
)
console.log('Solo modo safe. Ctrl+C cierra API y ambos destinos ficticios.')
let closing = false
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (closing) return
    closing = true
    await lab.close()
    await destinations.close()
  })
