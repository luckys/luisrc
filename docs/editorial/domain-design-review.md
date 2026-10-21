# Revisión: modelar el dominio y comunicar la arquitectura

## Revisión vigente: un concepto DDD por post, 21 de octubre de 2026

Por petición del autor, los cinco borradores iniciales pasan a diez. Se conservan
los cinco slugs e IDs anteriores. P044 se centra en Ubiquitous Language; el post de
agregados ya no explica Money por completo; el de repositorios remite la explicación
de domain events a su propia entrega. Se añaden contextos, entidades, valores,
servicios y eventos con ejemplos específicos, no solo encabezados nuevos.

Orden: lenguaje, contexto, entidad, valor, agregado, servicio de dominio, repositorio,
evento, C4, ADR. Manifest, cronología, prerrequisitos, navegación y los índices de
ambos repositorios sincronizados. Total de índices: 146 posts; siguen siendo 18
paquetes y 48 exports estáticos. Cinco diagramas nuevos; doce en esta serie.

El laboratorio añade Shipment, política temporal y validación/traducción de fechas.
El tipo de entrada pertenece a la política; la frontera depende de ese contrato,
no al revés. La política recibe el tiempo explícito, acepta el límite exacto de
duración y distingue falta de entrega, caducidad y reloj inconsistente. No utiliza
días de calendario ni interpreta normativa. La entidad logística y las reglas de
Returns no forman todavía un flujo con la reserva de pagos.

Once casos añadidos, 25 tests en total. Primero falló la carga por módulos ausentes;
después se observó rojo de tres casos de política con implementación pendiente,
y verde tras implementar la regla. No se atribuye ese ciclo a los tests anteriores.
Se contrastan quince extractos ejecutables, dos JSON y dos fragmentos ADR con sus
fuentes. Las pruebas editoriales comprueban orden y que las explicaciones separadas
ya no estén agrupadas. Código completo solo en el monorepo, snippets en cada post.

Verificación final: instalación congelada, 25 tests del laboratorio, tipos estrictos,
cuatro pruebas estructurales, 50 editoriales, build y 19 tests del blog pasan.
Chromium recorre veinte vistas de los diez posts en 1440/360 y dos del visor;
informe `/tmp/domain-design-layout.DfxpKw/report.json`. Se revisan capturas móviles
de valores, entidades y política. Tras compactar el diagrama de entidades y añadir
la referencia de event sourcing, se repiten las cuatro vistas afectadas y el visor:
`/tmp/domain-design-layout.hhx7jF/report.json`. No se suman repeticiones como tests
nuevos. Se inspecciona la captura final de entidades. Servidor temporal detenido.
Los diez borradores no se publican; el build conserva las diez páginas previamente
publicadas. No se repiten PostgreSQL/Redis ni todas las suites de laboratorios
no modificados: sus resultados de debajo pertenecen a la entrega inicial.

Los informes y cifras posteriores son históricos, no de esta ampliación.
Las explicaciones son específicas y mantienen alternativas, límites,
ejercicios y fuentes; la guía de escritura motivó ampliar mecanismos y ejemplos,
no multiplicar resúmenes. No hay commit, push, traducción, audio o publicación.

## Entrega inicial: 20 de octubre de 2026

## Alcance y división

Cinco nuevos artículos españoles, todos en draft, con autor Luis Ramírez Calle.
Ruta: [modelado y arquitectura](ruta-modelado-arquitectura.md). No se publica,
traduce, narra ni construye PaySafe. Amplía P044/P047, no toda la Serie 05.
La revisión de las bases de datos existentes está en
[cobertura de persistencia](persistence-architecture-coverage-review.md).

Una pregunta por entrega: significado y fronteras; representación/invariante;
confirmación concurrente; niveles C4; decisión/alternativas/evidencia. Money y
Payment permanecen juntos porque explican la misma regla, no cinco patrones sueltos.

La guía de escritura se aplica con aperturas concretas, ejemplos ficticios,
párrafos cortos, términos ingleses definidos, decisiones razonadas, alternativas,
límites y ejercicios con aceptación. No se presentan DDD, clases o microservicios
como obligaciones. Fuentes primarias consultadas el 2026-10-20 y enlazadas junto
a las afirmaciones; ningún benchmark o aprobación de equipo inventados.

## Código y evidencia

Fuente canónica: `luisrc-blog-examples/packages/domain-design`.
Node 24.19.0, TypeScript 5.9.2 estricto, pnpm 12.8.1. Primer intento de los tests
falló al no existir los módulos; después se implementaron y verificaron las reglas.
No afirmar una secuencia red/green por comportamiento que no se haya registrado.

- Catorce tests: once de dominio/aplicación, uno de trazas y dos documentales.
- Money valida precisión, moneda y operaciones; Payment mantiene reservas y
  construye una decisión nueva, sin mutar el original.
- Dos copias pueden aceptar 70 y 40 sobre 100. El fake confirma solo una por
  revisión. Las trazas releen: la segunda de 40 falla por límite; 20 + 30 llega a 50.
- El fallo de almacenamiento ocurre antes del commit; conserva estado/revisión/eventos.
- Dos escenarios generados ejecutando el repositorio en memoria; visor estático
  con selector, range por teclado y región aria-live. No mediciones de latencia.
- Seis snippets ejecutables, un fragmento JSON y dos extractos de la ADR se
  contrastan con las fuentes. Contexto/imports y fuentes completas enlazados.
- Siete diagramas D2/SVG con alt y dimensiones reales. Las tres vistas C4 indican
  propuesta; la ADR y RFC tampoco inventan infraestructura ejecutada o aprobaciones.

Solo se exportan `explorer.html`, `explorer.mjs` y `scenarios.json`, con SHA-256,
para construir el blog sin checkout hermano. Servidores, configuración y tests
permanecen en el monorepo. Índices sincronizados: 141 artículos, 18 paquetes y
48 recursos estáticos allowlisted. Los enlaces GitHub se comprueban contra archivos
locales; el remoto de ejemplos todavía debe crearse/subirse para que estén online.

## Verificación ejecutada

Desde ejemplos: instalación con lockfile congelado, 14 tests nuevos, typecheck,
demo, cuatro tests estructurales, 49 editoriales y las catorce suites locales de
`pnpm test:labs`. Sin iniciar Docker ni volver a ejecutar PostgreSQL/Redis o ML.

Desde el blog: build de producción, 19 tests, diez vistas Chromium de los artículos
en 1440/360 y dos del visor. Se comprueban 200, noindex, imágenes decodificadas,
enlaces internos, ausencia de overflow, tablas accesibles por teclado, slider,
conflicto/relectura/límite y cambio de escenario. Se inspeccionan capturas móviles
de diagramas y del visor, no solo el resultado automático.

Informe final: `/tmp/domain-design-layout.NyNYvB/report.json`. Se repiten las diez
vistas y ambos visores tras añadir títulos/estado a los SVG C4. Capturas móviles
de C4, mapa de contextos y visor inspeccionadas. No se suman repeticiones como
tests nuevos. Build final y 19 tests pasan: 50 rutas y diez páginas publicadas
indexadas; los cinco drafts nuevos no aparecen en producción. Servidor temporal
detenido y ausencia de servidor confirmada.

## Límites y aceptación pendiente

- Un solo proceso/pago por instancia del fake; reservas pequeñas y estado volátil.
- Sin transacción SQL, retención durable, relay, recuperación ante caídas o proveedor.
- La confirmación síncrona del fake no demuestra atomicidad o durabilidad de DB.
- La traducción logística y la reserva de pagos son ejercicios separados, no un
  flujo integrado de pedidos/devoluciones. No hay identidad/permiso de solicitantes.
- IDs repetidos se rechazan; no se reenvía un resultado anterior ni se garantiza
  idempotencia de un efecto externo. No hay retries automáticos en el caso de uso.
- Interfaz interna del repositorio, no validación de decisiones JSON hostiles.
- La ADR PostgreSQL/DynamoDB es conceptual y propuesta. No hay comparación medida.
- Los tests documentales comprueban estructura, no calidad del diseño o consenso.
- P044/P047 quedan con drafts y evidencia parcial, no aceptación automática de su DoD.
- Persisten gaps de series anteriores, incluidos P026 y los documentados para DB.

Siguiente: P043/P045/P046 con entregas específicas y luego revisión de P048/P051.
No hay commit ni push en este encargo; el usuario pidió continuar escribiendo.
