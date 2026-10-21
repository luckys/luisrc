# Revisión: Kafka, consumidores y reconstrucción

21 de octubre de 2026. Serie anterior confirmada: blog `4b33999`, ejemplos `7e50860`,
sin push. Antes del commit se repitieron 24 tests, typecheck y ocho checks cruzados/
estructurales de fundamentos. Esta nueva entrega de Kafka sigue sin commit.

## División y fuentes

Cinco drafts españoles de Luis Ramírez Calle: P051 log/retención; KAFKA-PARTITIONS
keys/orden; KAFKA-GROUPS asignación; KAFKA-REPLAY offsets/proyección; KAFKA-PRESSURE
lag/backpressure. Cada archivo ronda 1400–1550 palabras incluyendo código y metadata.
Ruta y manifest propios. La guía de escritura motivó separar lag y grupos por tener
preguntas/ejercicios distintos, sin convertir cada definición en otro post. Replay
mantiene commit y reconstrucción juntos para explicar sus ventanas de fallo.

Fuentes primarias consultadas: docs Kafka 3.9, Javadoc KafkaConsumer de rama 3.9,
docs KafkaJS 2.2.4 y fuente requestQueue; docs 4.1 solo para distinguir protocolos.
No se afirma que las versiones del lab sean las últimas. Se fijan explícitamente
para reproducir. Sin benchmarks universales o historias de producción inventadas.

## Laboratorio y TDD observado

Código solo en packages/kafka-streaming del monorepo separado. pnpm para instalación;
TypeScript 5.9.2, Node 24.19.0, KafkaJS 2.2.4. Imagen oficial Kafka 3.9.1 fijada a
sha256:4ceccc577f03f51f6af8dbfda55194d0d892f4fa7913ffbded567ce3895622ed.
KRaft broker/controller único, RF=1, host 127.0.0.1:19092, sin volúmenes del usuario,
TLS, SASL o cuentas. Límite de contenedor 1 GiB/2 CPU; no benchmark.

Tests escritos antes de implementar: imports ausentes fallaron. Ocho tests locales
pasaron tras implementación. Integración inicial pasó cuatro casos y falló al
truncar porque KafkaJS resolvía líderes con caché sin metadata nueva. Se aisló el
error y fetchTopicMetadata previo lo corrigió manteniendo low=2/high=3. Cleanup
se corrigió para borrar grupos antes de topics y aceptar solo grupo ya inexistente
(código 69). Typecheck detectó lib ES2023 incompatible con Promise.withResolvers;
se fijó ES2024, disponible en Node 24. No se atribuye ciclo red/green a cada caso.

Final observado: ocho tests locales, cinco de broker y typecheck pasan. Evidencia
se guarda solo si los cinco casos y cleanup terminan bien: evidence/broker.json.

- Dos grupos leen seis eventos y reconstruyen s-1/s-2 versión 3 delivered.
- Ambas keys terminaron en partición 1, offsets 0–5. Se mantiene esa observación,
  no se finge balance. El test de grupos puebla dos particiones explícitamente.
- Lectura 0 sin commit, nueva instancia repite 0; commit 1 reanuda 1/2 y confirma 3.
- Dos miembros con asignaciones distintas; salida limpia de uno deja ambas al otro.
  No procesos separados, kill, crash o prueba de todas las carreras de rebalance.
- Pause/resume: end 3, commits 0/1/3, lag de posiciones 3/2/0; no nuevos handlers
  mientras está pausado tras el primer commit. No carga sostenida o memoria perfilada.
- DeleteRecords explícito deja low 2/high 3; proyección vacía rechaza versión 3 sin
  historia anterior. Se observa política retention.ms=3600000 por API, no expiración
  temporal o compaction. No llamar a ese truncado una prueba de TTL.

KafkaJS produce TimeoutNegativeWarning con Node 24. Se obtuvo stack y fuente:
scheduleCheckPendingRequests resta Date.now() a throttledUntil=0 sin throttle.
No se oculta ni parchea la dependencia; tests reales obligatorios. No se infiere
pérdida de mensajes o clock skew de ese warning. README registra el diagnóstico.

## Evidencia editorial y de renderizado

Cuatro tests estructurales y 66 editoriales cruzados pasan: 169 índices, 22 paquetes
y mismos 48 exports allowlisted. Once snippets coinciden con fuentes ejecutadas.
Cinco D2/SVG con alt y dimensiones reales; capturas móviles inspeccionadas.
Enlaces GitHub contrastados con checkout local, no disponibilidad del remoto.

Build pasa: cincuenta rutas, 61 HTML, diez páginas publicadas y 4280 palabras
Pagefind. Diecinueve tests del blog pasan después del build. Inventario regenerado:
58 IDs exactos, 29 relacionados y 88 sin artículo, sin inferir aceptación de fichas.

Chromium: cinco artículos a 1440/360, diez vistas, H1/noindex, imágenes cargadas,
links locales 200, foco de código y sin overflow de página. Navegador ya instalado,
sin nueva descarga. Reporte /tmp/kafka-streaming-layout.0dHzDD/report.json.

Se repitió tras aclarar el cierre cooperativo: el primer intento se interrumpió
porque se cerró el servidor antes de terminar y expiró page.goto. No se relajó el
criterio. Repetición final con servidor activo hasta completar: diez vistas pasan,
/tmp/kafka-streaming-layout.fmKtZp/report.json. No sumar repeticiones como casos.
Build y 19 tests del blog repetidos tras los últimos cambios. Servidor final
pid 2950377 detenido y 4322 sin listener. Broker etiquetado detenido/retirado por
Docker; solo datos ficticios desechables, imagen descargada conservada. Ningún
contenedor de otro proyecto se detuvo. Cleanup usa --timeout, comprobado con el
help de Docker; no cambia el comportamiento probado con la antigua opción --time.

Se restaura únicamente el pruning/cambio de acorn automático del lockfile del blog
introducido por pnpm durante las verificaciones. El lockfile de ejemplos registra
el importer y KafkaJS nuevo. Dos revisiones automáticas de permisos expiraron sin
aplicar sus acciones; se comprobó estado y reintentó una vez con operaciones acotadas.

## Límites y continuidad

RF=1 y acks=all no prueban redundancia. Sin failover, TLS/SASL, cambios de particiones,
producer transactions, Schema Registry o exactly-once externo. Proyección/dedup en
memoria, checkpoint Kafka no hace durable la vista. Reconstrucción usa grupo nuevo
y destino vacío. El deadline de espera no mata un callback que no colabora; cierre
cooperativo, explicitado en post/README. No se reejecutan todos los labs históricos.

Siguiente: auditar Serie 06 contra fichas y artículos existentes antes de escribir.
Primer contraste P055/P056: tdd-pruebas-unitarias-integracion-contrato y labs API
ya existentes, antes de ampliar estrategia, doubles, TDD, contratos/Testcontainers.
Después P057/P058 y observabilidad; P064/P065 no tienen artículo candidato propio.
No basta renombrar el ID de un resumen para aceptar su temario y laboratorio.
Mantener español/draft y ejemplos separados; sin traducción, audio, publicación o
push. Los gaps P026 y Stripe sandbox P045 siguen abiertos. Esta entrega no acepta
automáticamente toda Serie 05. Los nuevos posts y lab quedan pendientes de commit.
