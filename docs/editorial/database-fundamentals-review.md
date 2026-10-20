# Revisión editorial: fundamentos de bases de datos

## Decisión de alcance

Dos preguntas y dos artículos independientes. ACID explica las garantías con
casos ejecutables; transacciones explica las herramientas SQL y el manejo de fallos.
No se presentan como capítulos de PaySafe. El roadmap original fue contexto de
planificación; la petición posterior del autor separa expresamente los fundamentos del proyecto.

## Recursos

Ocho diagramas D2 exportados a SVG. Las páginas solo cargan las imágenes;
no requieren D2, animaciones o un motor de diagramas en el navegador.
Cada diagrama tiene texto alternativo, dimensiones, carga diferida y enlace para ampliar.
Los casos son ficticios y didácticos, inspirados en patrones de aplicación.

El artículo de transacciones ofrece primero SQL y deja el código completo de
TypeScript dentro de un details nativo. El ZIP y los bloques deben coincidir exactamente.

## Verificación

Verificado con PostgreSQL 18.4: estados de atomicidad, rechazo de stock negativo,
actualización condicional sin filas, savepoints y reinicio ordenado. Los comandos
interactivos del lector produjeron 10000/10500 en READ COMMITTED y 10000/10000
en REPEATABLE READ, con el escritor confirmando 10500 en ambos casos.

Las nueve pruebas, los tipos y el experimento pasaron tanto en el workspace
como en una carpeta temporal extraída del ZIP e instalada con su lockfile.
Se compararon byte a byte 21 bloques de archivo y los 23 archivos de la descarga.

Chromium comprobó los ocho SVG, enlaces recíprocos, descarga y apertura/cierre
por teclado de la ampliación. No hubo errores de JavaScript ni desbordamiento de
página en 320, 390, 768, 1024 y 1440 px. Las tablas usan regiones desplazables.
Se inspeccionaron visualmente los diagramas para corregir texto pequeño y etiquetas solapadas.
El build generó 32 páginas e indexó cuatro artículos publicados; estos dos borradores
permanecen excluidos de las rutas de producción. Se conserva draft=true.

## Traducciones y narración — 2026-10-10

Ambos artículos tienen traducción inglesa, ocho SVG localizados y descarga
`transactions-lab-en.zip`. Los 21 bloques de archivo ingleses coinciden byte a byte
con la descarga. Las cuatro versiones conservan `draft: true`.

La descarga inglesa se instaló con su lockfile en una carpeta temporal limpia.
Tipos, nueve pruebas de integración y experimento pasaron con PostgreSQL 18.4
en un proyecto Docker aislado; los recursos de validación se eliminaron.

El narrador omite atributos HTML y listados `<pre>`, conserva el texto de tablas y
disclosures y separa bloques contiguos. Pasan diez pruebas de audio; los fingerprints
de los audios existentes se conservan. Build correcto y enlaces/SVG/ZIP ingleses
responden correctamente en el servidor local.

La generación de los cuatro audios está pendiente: con autorización expresa del
usuario para Microsoft Edge TTS, el servicio responde HTTP 403. Se confirmó con
edge-tts-universal y edge-tts 7.2.8. No se modificó el manifiesto ni se publicaron
grabaciones parciales.

## Límites del contenido

Las transacciones no inventan invariantes, no incluyen servicios HTTP externos
y no resuelven una confirmación incierta. El aislamiento no es una garantía universal
de serializabilidad. Un reinicio ordenado no equivale a un corte eléctrico ni a
una prueba completa de durabilidad.

## Ampliación de la serie — 2026-10-17

La petición del autor amplía la base de conocimientos, sin vincular las entregas a
PaySafe ni construir ese producto. Se conservan los dos artículos originales y
se añaden trece, solo en español y todos con `draft: true`. SQL e índices se
separan en dos partes cada uno; migraciones y particionado son entregas distintas.
El orden y el mapa P032–P041 están en `database-fundamentals.yaml` y
`database-series-scope.md`.

### Contenido y fuentes

Una pregunta dominante por artículo, aperturas con un fallo reconocible,
terminología inglesa explicada, decisiones y alternativas, garantías y límites,
ejercicio con aceptación y enlaces entre entregas. El glosario sirve como índice
de conceptos, no como sustituto de su explicación.

Se consultó documentación primaria de PostgreSQL 18, Redis, MongoDB, DynamoDB,
Cassandra, Elasticsearch y pgvector, además de Microsoft y los apuntes del RPI
para normalización. Referencias y fecha de consulta figuran en los artículos.
No se han inventado planes, tiempos de ejecución ni comparativas entre motores.

### Recursos y código

Laboratorio autocontenido `https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/`, PostgreSQL 18.4 y Redis
fijados por digest, sin puertos publicados. Trece scripts SQL y herramientas Node
sin dependencias adicionales. Los snippets SQL identificados por archivo se
comparan con los originales. El ZIP contiene veinte archivos y sus bytes se
comparan con los del árbol revisado.

Trece diagramas D2 renderizados como SVG y una gráfica ECharts SSR a partir de
`results/benchmark.json`. Los diagramas lineales más anchos se reorganizaron en
vertical tras inspeccionar sus PNG. Todos tienen texto alternativo, dimensiones
reales, carga diferida y enlace de ampliación; no añaden un motor de diagramas al
navegador.

### Verificación realizada

- Catorce pruebas funcionales con PostgreSQL/Redis reales: constraints, snapshots,
  write skew, lost update, actualización condicional, versiones, LEFT JOIN,
  EXISTS, locks, ON CONFLICT, deadlock, resumen obsoleto, migración, particiones,
  carrera de invalidación y proyección JSON (algunas agrupadas en una prueba).
- El mismo laboratorio se ejecuta desde el ZIP extraído en un entorno temporal
  independiente, con otro nombre de proyecto Docker.
- Comprobaciones editoriales de inventario, prerrequisitos, recursos locales,
  metadatos, enlaces y coincidencia del código y de la descarga.
- Los trece borradores responden HTTP 200 en desarrollo; sus anclas de índice,
  quince recursos locales y meta `noindex` se comprobaron sobre el HTML real.
- Build de producción correcto. Los borradores no se incluyen en las rutas
  públicas de artículos, el sitemap ni los feeds. Tests existentes de SEO/audio
  también pasan sin solicitar síntesis de voz.

### Límites de la verificación

No había un navegador de automatización conectado: no se afirma QA visual
completo de páginas ni una revisión de interacción móvil. Sí se inspeccionaron
los diagramas rasterizados y se analizaron las páginas renderizadas por HTTP.

La medición de índice es sintética, local, con una ejecución de calentamiento y
siete muestras por variante; WAL se compara con una pasada por variante. La
migración ensaya SQL secuencial, no un rolling deployment. El particionado usa
dos filas y no pretende medir escala. La comparación de MongoDB y DynamoDB es
conceptual: esos servicios no se ejecutaron. El ejemplo de caché demuestra una
carrera; no implementa ni promete coherencia fuerte distribuida.

No se generaron traducciones ni audios; no se publicaron artículos ni se hizo commit.
