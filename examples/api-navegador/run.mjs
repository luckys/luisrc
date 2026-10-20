import { startLab } from './lab.mjs'
const lab = await startLab()
console.log('Sandbox vulnerable SOLO en loopback. No publiques ni uses datos reales.')
console.log(`Aplicación y sesión ficticia: ${lab.app}/session`)
console.log(`XSS: ${lab.app}/xss?mode=unsafe`)
console.log(`Formulario local: ${lab.attacker}/form?target=unsafe`)
console.log(`Origen CORS permitido: ${lab.trusted}`)
console.log(`Formulario cross-site: ${lab.crossSite}/form?target=unsafe`)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await lab.close()
    process.exit(0)
  })
