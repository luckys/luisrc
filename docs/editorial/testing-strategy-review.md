# Revisión: pruebas de software, reglas y evidencia

22 de octubre de 2026. Serie Kafka confirmada: blog `4cd1476`, ejemplos `b501dab`,
sin push. Antes del commit se repitieron ocho checks de estructura/editorial,
ocho tests locales y typecheck. El primer comando de checks omitió BLOG_ROOT y
falló; corregido el entorno, pasó. No se repitió el broker: evidencia y límites
de su revisión anterior siguen vigentes.

## División y aceptación de este bloque

Cinco drafts de P055, autor Luis Ramírez Calle, solo español. Diseño/oracle,
TDD, doubles, niveles y coverage/mutaciones; 1400–1550 palabras incluyendo
metadata/código cada uno. La guía de escritura motivó separar decisiones con
ejercicios distintos, manteniendo juntos fake y contrato. No se duplica DESIGN-TDD
ni se renombra para aparentar una ficha aceptada. Ruta y manifest propios.

Criterios: explicar el porqué con un modelo común; código ejecutado, snippets
contrastados, diagrama por artículo, límites y referencias; mantener draft y
ejemplos completos solo en monorepo separado. La guía flow exige contrastar cada
afirmación con la frontera efectivamente probada, no solo un build o un contador.

Fuentes primarias consultadas el 21: Node 24 test runner y SQLite, Fowler Test
Driven Development/Test Double/Mocks Aren't Stubs, Ham Vocke Practical Test Pyramid
y documentación Stryker. Docs versionadas v24.19.0 no accesibles por el navegador;
se consultó rama 24, sin afirmar que lo ejecutado es la última versión. Redacción
final el 22. Reglas de jobs y datos del laboratorio son ejemplos propios.

## Código, TDD y resultados

packages/testing-strategy, Node 24.19.0, TS 5.9.2 estricto, sin dependencias runtime
nuevas. Solo importer de devDependencies reutilizadas en lockfile de ejemplos.

TDD observado: primer test terminal falla por módulo ausente; implementación que
devuelve el estado falla con Missing expected exception; regla mínima pasa. La
matriz añade seis fallos/15 éxitos sobre esa versión y pasa tras completar tabla.
Se separan transitions y machine manteniendo comportamiento. Objetos/servicio/
repositorios tuvieron tests previos a módulos y fallos de exports/imports. No
atribuir ciclos individuales de comportamiento a cada escenario ni al handler.

- 28 tests locales: 24 de núcleo (veinte parejas, terminal, objeto, entradas y
  comandos) y cuatro de servicio (stub/spy, error, conflicto y fake con estado).
- Once de contratos/HTTP: tres escenarios contra Map y los mismos tres contra
  SQLite real en memoria; uno de archivo con cierre/reapertura y cuatro HTTP.
- Suite débil aparte, un test sin aserciones: 100 % líneas/branches/funciones de
  transitions.ts únicamente. No se incluye en el test normal ni se llama calidad.
- Cuatro mutaciones manuales en copias temporales: pasan el test débil y fallan
  por ERR_ASSERTION en el núcleo. Tres en reglas ejecutadas; versión en machine.ts
  fuera del scope del test débil. Sin Stryker o score global. Baselines obligatorios,
  timeout/import/syntax errors no aceptados como detección.
- Typecheck pasa. mutation/verify repetidos con código final; artefactos SHA-256
  en evidence/mutations.json y verification.json, solo se escriben si el run pasa.

Fixture HTTP: SQLite nueva, loopback/puerto efímero, espera listening, no sleeps,
cierre de conexiones/servidor/DB. Archivo solo en mkdtemp con cleanup propio. No
Docker o servicios del usuario. Registro de estados, no worker. Repeat con versión
actual es no-op; versión antigua es conflicto, no replay por idempotency key.

Instalación inicial pnpm offline pasó; repetición frozen/offline el 22 falló porque
la caché de políticas no tenía metadata de rolldown, dependencia histórica ajena
al nuevo paquete. pnpm install --frozen-lockfile --ignore-scripts con registro pasó,
sin cambiar las versiones fijadas. No se desactivó la política ni se modificó el
criterio. Primera lectura tras interrupción expiró en revisión automática sin
ejecutarse; reintento acotado pasó.

## Comprobaciones editoriales y compilación

74 checks cruzados/estructurales pasan, incluidos cuatro nuevos: orden, autor,
drafts y dependencias; trece extractos; cinco SVG con fuente/alt/dimensiones; hashes,
scope y resultados de evidencia. Índices: 174 posts, 23 paquetes y mismos 48 exports
estáticos. Enlaces GitHub contrastados con checkout local, no disponibilidad remota.

Build pasa: 50 rutas, 61 HTML, diez páginas publicadas, 4280 palabras Pagefind.
Los cinco drafts no salen en producción. Primer run de tests del blog detectó
inventario obsoleto para P055; regenerado desde front matter, los 19 tests pasan.
Inventario 59 IDs exactos, 28 relacionados, 88 sin artículo: no aceptación global.
No se reejecutan todos los laboratorios históricos o integraciones de otros motores.

## Revisión visual

Checker dedicado, mismos criterios que Kafka: cinco posts por 1440/360, H1,
noindex, enlaces locales, SVG cargados, foco de código/tablas y overflow de página.
Primer intento no arrancó: no existía el binario headless en caché. No había otro
navegador local. Instalado con pnpm exec playwright install chromium --only-shell:
Chromium headless 141/build1194 y FFmpeg1011. Playwright avisa de fallback Ubuntu
24.04 por OS no soportado oficialmente; no se afirma soporte de otros navegadores.

El primer recorrido con navegador detectó overflow móvil en P055: tabla de 452 px,
scrollWidth de página 464 a viewport 360. Corregidas las cinco tablas con el patrón
existente de regiones etiquetadas/tabindex/overflow-x:auto, sin cambios globales
de CSS o reducción de criterios. Check editorial nuevo exige un wrapper por tabla.
Build y 19 tests del blog repetidos tras el ajuste; ocho checks de la serie/estructura
también pasan. Diez vistas completas pasan: /tmp/testing-strategy-layout.zHdxJb/report.json.
Cinco capturas de diagramas móviles inspeccionadas y legibles.

Se detectó que los nombres de capturas de tabla se sobrescribían al recorrer además
regiones de código. El checker nuevo selecciona las regiones con table y usa un
índice por tabla; la aserción de foco/scroll sigue igual. Las capturas reales de
tablas se inspeccionaron en /tmp/testing-strategy-layout.SS200A. Se afinó después
la matriz: etiquetas en negrita y nowrap para no partir los nombres de estado;
el checker exige que sus trece etiquetas ocupen una sola línea. Recorrido final
completo: diez vistas pasan, /tmp/testing-strategy-layout.Mdgv7C/report.json.
Captura final de matriz inspeccionada. Build, 19 tests del blog y 74 checks cruzados/
estructurales pasan tras ese ajuste. No sumar repeticiones como casos nuevos.

Servidor final pid 3042197 cerrado después del checker; puerto 4322 sin listener.
Se retira únicamente el pruning/cambio automático del lockfile del blog introducido
por pnpm en estas verificaciones. El lockfile de ejemplos mantiene su importer nuevo.
No hay cambios de dependencias solicitados en el blog ni servicios de laboratorio
pendientes de cierre. Los datos retirados son solo fixtures/copias temporales propias.

## Límites y continuidad

SQLite no representa PostgreSQL; Map no representa SQL. DatabaseSync síncrono,
una conexión, sin procesos escritores concurrentes o carreras forzadas. Reapertura
con cierre limpio, no crash/energía. HTTP componente no es E2E de UI/plataforma.
Sin identidad, TLS, worker, Testcontainers, Pact, fuzzing, Stryker, benchmark o
exactly-once externo. Cuatro mutaciones seleccionadas no estiman todos los defectos.

Siguiente P056: contrastar posts de contratos/evolución y api-contracts/
api-pagination-evolution antes de ampliar fixtures/factories/lifecycle Testcontainers
y contratos verificados por clientes. Separar consumer-driven de schema validation
y de este contrato local de adaptadores. Después P057/P058 y observabilidad.
P026 y Stripe sandbox P045 siguen abiertos. Nuevos posts/lab pendientes de commit,
sin traducción, audio, publicación o push. No declarar Serie 06 completa.
