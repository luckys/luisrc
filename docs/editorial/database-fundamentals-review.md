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
