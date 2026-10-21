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
  'Ampliación de Serie 05: diez drafts de modelado/documentación P044/P047, siete de principios P043, cinco de fronteras P045/P046, seis de fundamentos P048 y cinco de Kafka P051. kafka-streaming usa un broker real local 3.9.1, grupos clásicos, replay de dos envíos, checkpoints y pause/resume; RF=1, proyección volátil, sin failover o exactly-once. El prefijo eliminado por DeleteRecords no prueba retención temporal. Los laboratorios anteriores conservan sus límites, incluido Stripe sandbox de P045. Bases de datos mantiene quince entregas. Siguiente: auditar lagunas de Serie 06. Ver ruta-kafka-streaming.md y rutas previas. Ni IDs ni recuentos aceptan el roadmap.',
  '',
]
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
