import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import YAML from 'yaml'

const roadmap = await readFile('docs/roadmap-editorial-ingenieria-paysafe-ia.md', 'utf8')
const catalog = roadmap.slice(
  roadmap.indexOf('## 3. Catálogo completo'),
  roadmap.indexOf('## 4.'),
)
assert.ok(catalog.length > 10000, 'Catálogo general no localizado')
const candidates = JSON.parse(
  await readFile('docs/editorial/roadmap-related-posts.json', 'utf8'),
).candidates
const posts = new Map()
const slugs = new Set()
for (const filename of await readdir('src/content/posts/es')) {
  if (!filename.endsWith('.md') && !filename.endsWith('.mdx')) continue
  const source = await readFile(`src/content/posts/es/${filename}`, 'utf8')
  const header = YAML.parse(source.match(/^---\n([\s\S]*?)\n---/)[1])
  slugs.add(header.slug)
  if (/^P\d{3}$/.test(header.id ?? '')) {
    assert.ok(!posts.has(header.id), `ID duplicado: ${header.id}`)
    posts.set(header.id, {
      path: `src/content/posts/es/${filename}`,
      slug: header.slug,
      draft: header.draft === true,
    })
  }
}
const series = []
let current
for (const match of catalog.matchAll(
  /^### Serie (\d+)\. ([^\n]+)|^#### (P\d{3})\. ([^\n]+)/gm,
)) {
  if (match[1]) {
    current = { id: match[1], title: match[2], articles: [] }
    series.push(current)
    continue
  }
  const id = match[3]
  const related = candidates[id] ?? []
  for (const slug of related) assert.ok(slugs.has(slug), `Referencia inexistente ${slug}`)
  current.articles.push({
    id,
    title: match[4],
    status: posts.has(id)
      ? 'draft_exists'
      : related.length
        ? 'related_only'
        : 'not_written',
    exactPost: posts.get(id) ?? null,
    related,
    verification:
      'Revisar temario, laboratorio y DoD de la ficha; no inferir completitud por título o ID.',
  })
}
assert.equal(series.length, 16)
const articles = series.flatMap((s) => s.articles)
assert.equal(articles.length, 175)
assert.deepEqual(
  articles.map((x) => x.id),
  Array.from({ length: 175 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`),
)
const counts = Object.fromEntries(
  ['draft_exists', 'related_only', 'not_written'].map((status) => [
    status,
    articles.filter((x) => x.status === status).length,
  ]),
)
const report = {
  objective:
    'Completar en español todas las fichas del roadmap, por series, con ejemplos y recursos estáticos e interactivos pertinentes.',
  counts,
  completionProven: false,
  criteria:
    'draft_exists indica archivo con ID, no aceptación de todos los requisitos. related_only exige ampliar o escribir una ficha. No renombrar IDs para aparentar cobertura.',
  series,
}
await writeFile(
  'docs/editorial/roadmap-progress.json',
  JSON.stringify(report, null, 2) + '\n',
)
const lines = [
  '# Estado del roadmap completo',
  '',
  'Inventario generado desde el catálogo de 175 fichas y los artículos españoles reales. No es una certificación de completitud editorial ni de laboratorios.',
  '',
  `IDs con borrador propio: **${counts.draft_exists}**. Solo material relacionado: **${counts.related_only}**. Sin artículo identificado: **${counts.not_written}**.`,
  '',
  'Cada ficha requiere revisión contra su temario obligatorio, laboratorio y Definition of Done. Un artículo agrupado no completa automáticamente varias fichas.',
  '',
  '## Orden de continuación',
  '',
  'Redactadas las series 01 y 07–09. En Serie 02, P011 se desarrolla en 21 entregas exclusivamente de estructuras de datos y algoritmos; P010 y P012–P019 siguen fuera del encargo actual. Serie 03 tiene treinta y seis entregas: P020–P031; P030 desarrolla nueve partes y P031 cuatro. P031 compara polling/SSE con sockets reales, GraphQL N+1/batching y gRPC unary con cliente anterior y deadline. Callbacks y subscriptions remiten a mecanismos previos; no hay broker durable ni GraphQL subscription ejecutada. Los ejemplos viven en el monorepo separado. T05 SSRF, T06 admisión y T07 credenciales/secretos se prueban en fixtures de un proceso, sin infraestructura cloud. Las API keys identifican clientes, no personas. Refresh sigue separado del RP OIDC. P029 verifica XSS/CSRF/CSP/CORS en Chromium loopback. Valorar siempre posts pequeños y específicos. Revisar/ampliar 04–06 contrastando artículos existentes, después Deep Learning y series 11–16. Revisar límites declarados, especialmente P026. No hay publicación o traducción autorizada.',
  '',
  'Reproducir inventario: `node scripts/audit-editorial-roadmap.mjs`. El detalle estructurado conserva candidatos y rutas en roadmap-progress.json. Estado del objetivo: activo; no se ha probado que esté completo.',
  '',
  'Ampliación de Serie 05: diez drafts de modelado/documentación P044/P047, siete de principios P043, cinco de fronteras P045/P046, seis de fundamentos P048 y cinco de Kafka P051. kafka-streaming usa un broker real local 3.9.1, grupos clásicos, replay de dos envíos, checkpoints y pause/resume; RF=1, proyección volátil, sin failover o exactly-once. El prefijo eliminado por DeleteRecords no prueba retención temporal. Los laboratorios anteriores conservan sus límites, incluido Stripe sandbox de P045. Bases de datos mantiene quince entregas. La continuación de Serie 06 se detalla debajo. Ver ruta-kafka-streaming.md y rutas previas. Ni IDs ni recuentos aceptan el roadmap.',
  '',
]
lines.push(
  'Inicio de Serie 06: P055 se amplía en cinco drafts de diseño de pruebas, TDD, doubles, niveles y coverage/mutaciones. Ver ruta-pruebas-software.md. Laboratorio testing-strategy: fake Map, SQLite real y HTTP loopback; sin UI E2E, PostgreSQL o Testcontainers en ese paquete. Coverage 100 % solo en transitions.ts con una suite deliberadamente débil; cuatro mutaciones manuales, no Stryker. No aceptación automática de toda Serie 06.',
  '',
  'P056 continúa con cinco entregas de Testcontainers, fixtures/factories, aislamiento, schema tests y consumer-driven contracts. Ver ruta-integracion-contratos.md. Paquete integration-contracts con PostgreSQL18.4 real por digest, HTTP loopback y Pact17.1.4 local; cuatro tests de núcleo, dos del consumidor y nueve de integración. Sin Broker, CI desplegada, HA o disco durable. Recuperación por timeout codificada, sin muerte forzada probada.',
  '',
  'P057 se amplía en siete drafts de propiedades/generadores, shrinking/replay, modelo, carreras, fuzzing, fault injection y evaluación por mutaciones. Ver ruta-pruebas-propiedades.md. Paquete property-testing con fast-check4.10.2: quince tests, contraejemplo de tres eventos reducido y replay, scheduler y tres variantes manuales. Solo memoria; sin crash real, SQL, PSP, guía por cobertura o motor Stryker.',
  '',
  'P058 se amplía en siete drafts de distribuciones, modelos de carga, saturación, carga sostenida, microbenchmarks, CPU y memoria. Ver ruta-rendimiento-profiling.md. performance-lab: k6 2.3.0 real en procesos separados, siete fases HTTP locales, tres procesos de benchmark, tres CPU profiles y seis heap snapshots. Diez tests rápidos; datos recalculables, dos gráficas y visor estático. Sin soak prolongado, producción/SQL, CPU aislada o retained size. Gaps P026 y Stripe sandbox P045 conservados; no aceptación automática de Serie06.',
  '',
  'P059 se amplía en seis drafts: logs/identidades, spans, propagación React/API/worker, sampling, métricas y exemplars. Ver ruta-observabilidad.md. observability-lab ejecuta SDK OTel3.0.0/API1.10.0, HTTP real y worker por IPC en otro PID; cinco clics Chromium, veinte spans, diez logs, cuatro ok/un error. Sin sampling no exporta spans pero sí mide el job. Reservoir de exemplars y serializador propios porque el SDK metrics JS3.0.0 no los exporta; sin OTLP, Collector, backend, ingestión Prometheus o broker durable. Visor archivado y gráfica derivada. No aceptar la serie contando IDs.',
  '',
  'P060 se amplía en seis drafts: SLI/elegibilidad, cohortes, ventanas/cobertura, presupuesto/política, burn rate y alertas multi-window. Ver ruta-sli-slo-presupuestos.md. service-objectives simula siete escenarios de treinta días, sin tráfico real. Doce tests, evidencia recalculable, TypeScript compartido con el visor, seis diagramas y gráfica derivada. Mismo presupuesto para degradación activa y recuperada, distinto estado de alerta. Sin endpoint desplegado, paging, Prometheus/Alertmanager, calendario civil o enforcement de política. P061 continúa con triage, mitigación, runbooks y postmortems; ver la ampliación siguiente. Mantener gaps P026, Stripe sandbox P045 y soak P058.',
  '',
  'P061 se amplía en seis drafts: triage, mitigación/verificación, runbooks, on-call/handoff, postmortem y acciones. Ver ruta-incidentes.md. incident-response ejecuta HTTP real con API y worker en procesos distintos, once eventos y nueve tests. Tres trabajos sin progreso tras aceptar lote cero; recuperación de cinco anteriores y dos nuevos, sin borrar IDs. Checkpoint parcial, hashes y replay estático. Roles/documentos ficticios, sin guardia humana, alertas instaladas, durabilidad, crash recovery o deployment de un binario. A01/A03 verificadas solo en fixture; A02/A04 abiertas. Docker se amplía en P062, a continuación. Mantener gaps P026, Stripe sandbox P045 y soak P058.',
  '',
  'P062 se desarrolla en seis drafts: images/containers, layers/cache/contexto, multi-stage, Compose/redes/readiness, volúmenes y seguridad. Ver ruta-docker-entornos.md. container-environments levanta API, Redis8.8.1 y PostgreSQL18.4 reales con Node24.19.0. Diez fases, cinco tests y quince hashes: cache de instalación tras cambiar source, API recreada, caídas Redis/SQL, volumen conservado y dos setups vacíos de datos. UID1000, escritura EROFS y configuración de restricciones de la API observados; no scan, firma, backup restore, multi-arch, benchmark o build bit reproducible. Seis D2, gráfico de tamaños locales y visor estático. Captura repetida al cambiar lock raíz por P063, sin quitar control de hashes. Objetivo completo pendiente; recuentos no aceptan la serie.',
  '',
  'P063 se amplía en ocho drafts: pipeline/gates, artefactos, flags, smoke, rolling, blue-green, canary y rollback compatible. Ver ruta-ci-cd-despliegues.md. progressive-delivery ejecuta ocho gates locales con audit runtime, siete tests, dos images por ID y dieciocho fases con HTTP/PostgreSQL reales. Canary sintético estratificado:200respuestas200,20precios incorrectos del candidato/180correctos del control; retirada verificada. Blue v1 se prepara antes de conmutar a green v2, conservando vuelta. Flag off mantiene image; rollback real vuelve a v1, conserva cuatro filas y admite una quinta. Contract negativo42703 dentro de transacción revertida. Ocho D2, gráfica y visor de fases/cohortes paginado. Sin CI remoto, Kubernetes, disponibilidad continua, usuarios reales, scan SO, firma o backup restore. Siguiente P064 AWS con comparación declarada Lambda/ECS, después P065/P066. Conservar gaps P026, Stripe sandbox P045 y soak P058; Serie02 solo estructuras/algoritmos.',
  '',
)
for (const entry of series) {
  lines.push(`## Serie ${entry.id}. ${entry.title}`, '')
  for (const article of entry.articles) {
    const label =
      article.status === 'draft_exists'
        ? `[borrador](../../${article.exactPost.path})`
        : article.status === 'related_only'
          ? 'relacionado, requiere revisión'
          : 'pendiente'
    lines.push(`- ${article.id}. ${article.title}: ${label}.`)
  }
  lines.push('')
}
await writeFile('docs/editorial/roadmap-progress.md', lines.join('\n'))
console.log(counts)
