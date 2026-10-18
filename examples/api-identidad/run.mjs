import { startLab } from './lab.mjs'
const lab = await startLab()
console.log(
  `RP: ${lab.origin}\nOP de prueba: ${lab.issuer}\nCertificado autofirmado solo local. Ctrl+C limpia servidores y claves temporales.`,
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await lab.close()
    process.exit(0)
  })
