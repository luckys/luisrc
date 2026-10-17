# Revisión: Frontend y tiempo real

Fecha: 17 de octubre de 2026. Autor: Luis Ramírez Calle. Estado editorial: draft.
Encargo: commit del trabajo anterior y siguiente serie generalista, solo español.
Commit previo creado: `818d12b` en `posts-series`; esta serie nueva queda sin commit.
No se ha hecho push, publicado, traducido ni generado audio.

## Resultado y alcance

Nueve artículos P067–P075, 8.272 palabras contando metadatos y código. Cada uno
entre 859 y 983 bajo ese mismo recuento; no es una estimación de palabras de prosa.
Orden y dependencias en frontend-series.json; índice en ruta-frontend-tiempo-real.md.
No dependen de conocer PaySafe ni presentan una implementación de ese producto.

Nueve diagramas D2/SVG y una gráfica a partir de muestras archivadas. Código
React/TypeScript y laboratorio descargable de 21 archivos, con lockfile y permiso
de build de esbuild propios. Sin node_modules, dist, capturas o informes de test.

## Evidencia técnica ejecutada

- `node --test tests/*.test.mjs`: 28 tests, incluidos cinco nuevos de esta serie.
  Comprueban nueve drafts, orden/prerrequisitos, enlaces, dimensiones/alt de SVG,
  diez extractos mínimos coincidentes con archivos, inventario/bytes de ZIP y medianas.
- `pnpm --dir examples/frontend-tiempo-real test`: siete tests deterministas.
  Respuesta antigua, cancelación ignorada por adaptador, rollback/confirmación,
  conservación de revisión posterior, extremos de ventana, scope de selección y secuencias.
- `pnpm --dir examples/frontend-tiempo-real typecheck`: TypeScript strict, sin errores.
- `pnpm --dir examples/frontend-tiempo-real test:browser`: catorce tests Chromium.
  Teclado, HTML SSR/CSR sin JS, hydration, optimismo/rechazo, búsqueda, ventana,
  paginación/foco, 360 px, reset y replay SSE, dos pestañas Yjs con recarga,
  audio WebRTC sintético, captura tardía tras colgar y permiso denegado.
- Total: **49 tests distintos** entre repositorio, lógica y navegador. Las repeticiones
  sobre el ZIP no se suman otra vez. No se han reejecutado aquí los labs PostgreSQL/Redis
  de entregas anteriores; su evidencia permanece en sus revisiones.
- ZIP extraído bajo `/tmp/frontend-zipcheck.*`: `pnpm install --frozen-lockfile`,
  siete tests, tipos y catorce tests de navegador aprobados desde la copia aislada.
- `node scripts/check-frontend-drafts.mjs`: nueve páginas HTML locales, once recursos,
  noindex, numeración 1/9–9/9 y anclas de tabla de contenidos correctas.
- `pnpm build`: Astro genera 48 páginas, Pagefind indexa ocho artículos publicados
  en dos idiomas. Los nueve borradores no generan páginas públicas.
- `git diff --check`: sin errores de whitespace.

Las pruebas de lógica se escribieron antes de crear state.ts/data.ts y se observó
el fallo inicial por módulos ausentes. Las de navegador son comprobaciones de
integración y regresión; no se presenta toda su escritura como ciclos TDD independientes.

## Incidencias encontradas y resueltas

1. El selector de status SSE era ambiguo: `output` tiene ese rol implícito. La prueba
   ahora identifica el párrafo de feedback concreto, manteniendo la aserción del contador.
2. La colección completa se generaba también al importar utilidades desde el cliente.
   Se separó en tools/fixtures.mjs, exclusivo del servidor. La ventana calcula posiciones
   ficticias visibles; la tabla consulta páginas de 20 por HTTP.
3. La instalación fuera del workspace bloqueaba el build de esbuild. Se añadió un
   pnpm-workspace.yaml autónomo que permite solo ese build; instalación congelada repetida.
4. Una primera inspección Playwright de páginas del blog encontró un contexto destruido
   durante recarga de desarrollo. Se repitió tras estabilizar archivos y esperar carga;
   las dieciocho combinaciones de nueve páginas y dos viewports se verificaron.
5. El lockfile de pnpm 12 contiene dos documentos YAML: gestor y aplicación. Se comprobó
   el documento de dependencias y se añadió una aserción sobre el importer del ZIP.

## Medición y revisión visual

Microexperimento en results/dom.json: Chromium 141.0.7390.37, Node 24.19.0, Linux,
Intel Core Ultra 9 285H, viewport 1280×720. Una ronda de calentamiento y siete medidas
alternadas por variante. Medianas: 5.000 filas 41,5 ms; 14 filas aproximadamente 0,3 ms.
El intervalo incluye crear nodos y forzar layout, no React, scroll ni presentación completa.
No se denomina INP ni se extrapola a una mejora equivalente en producción.

Inspección de los nueve SVG y gráfica mediante PNG en `/tmp/frontend-diagrams-0.png`,
`frontend-diagrams-1.png`, `frontend-diagrams-2.png` y `frontend-dom-chart.png`.
Etiquetas sin recortes visibles; los enlaces permiten ampliar diagramas densos.
Inspección del primer artículo real en `/tmp/frontend-post-1440.png` y
`frontend-post-360.png`, modo oscuro. Título, metadatos y TOC sin superposiciones.
Comprobación automática de las nueve páginas a ambos anchos, sin overflow global.
Estas capturas son QA temporal, no baselines de visual regression.

## Revisión de fuentes y estilo

Fuentes primarias enlazadas junto a afirmaciones y al final: React, WAI/WCAG,
WHATWG HTML, documentación de APIs MDN, web.dev, TanStack Query, PostgreSQL 18,
Yjs, W3C WebRTC, Astro, ShareDB y Playwright. Storybook se revisó en su guía
«Why Storybook?» después de que otra URL de documentación no devolviera contenido.
Consulta web el 17 de octubre de 2026, sin copiar pasajes extensos.

Aplicada la guía de escritura: apertura con problema concreto, decisiones y alternativas,
inglés técnico explicado, palabras clave destacadas, límites junto al mecanismo y
ejercicios comprobables. Sin guiones largos, anécdotas inventadas o cifras no medidas.

## Lo que no demuestra esta entrega

- No certificación WCAG, revisión con lector de pantalla ni matriz de navegadores reales.
- No benchmark SSR/CSR de campo, build SSG o streaming SSR del laboratorio.
- No optimización de tabla React antes/después ni INP medido en usuarios.
- No bulk actions, SQL keyset integrado, selección global persistida o autorización real.
- No Storybook instalado ni screenshots comparados con un baseline aprobado.
- No WebSockets ejecutados, proxy, varios servidores o retención SSE duradera.
- No editor completo, proveedor Yjs remoto, OT ejecutado o garantía offline ante caída.
- No STUN/TURN ejecutados, llamada entre equipos o latencia acústica medida.

Son límites explícitos en artículos y scope, no laboratorios del catálogo marcados
como completados. La siguiente serie global es matemáticas/estadística; los bloques
de cloud y especializaciones siguen pendientes. No se deja el servidor local arrancado
como parte de la entrega.
