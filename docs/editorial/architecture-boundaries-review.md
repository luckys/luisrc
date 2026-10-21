# Revisión: arquitectura, dependencias, módulos y despliegues

Fecha: 21 de octubre de 2026. Los commits `8cb7108` (blog) y `e3fb352` (ejemplos)
conservan la serie previa de siete artículos de principios, tras revisión completa.
También se confirmaron los pendientes DDD al inicio: `a7b4e69` y `9316534`.
Sin push. Esta entrega posterior añade cinco drafts, no incluidos en esos commits.

## División y alcance

P045: puertos/adaptadores; ARCH-LAYERS: capas/Clean; ARCH-OWNERSHIP: módulos/datos;
ARCH-CQRS: modelos de lectura; P046: costes de distribución. Ruta de lectura en
ruta-fronteras-arquitectura.md y manifest architecture-boundaries-series.json.
Todos en español, draft y autor Luis Ramírez Calle, con enlaces hacia entregas
anteriores. Cada uno ronda 1300–1450 palabras contando código y metadatos.

Se separan problemas, mecanismos y ejercicios. Hexagonal no se presenta como seis
capas; Clean no se prueba contando carpetas; ownership no implica una red; CQRS no
impone broker/Event Sourcing; microservicios no son la madurez obligatoria de un
monolito. Fuentes primarias enlazadas cerca de las definiciones, sin anécdotas,
aprobaciones o benchmarks inventados. La guía de escritura motivó esos contrastes
y explicaciones de por qué y cuándo no aplicar cada técnica.

## Laboratorio y pruebas observadas

Código completo solo en `luisrc-blog-examples/packages/architecture-boundaries`.
Node 24.19.0, TypeScript 5.9.2 estricto, pnpm 12.8.1. Instalación offline y luego
con lockfile congelado pasan. Tests ejecutan TypeScript con borrado de tipos;
typecheck separado. Archivos y carpetas en inglés, diez extractos ejecutables y
uno de ADR permanecen dentro de los artículos y se contrastan con la fuente.

Primero fallaron imports por módulos ausentes. Con implementación de fronteras y
proyección pendiente, catorce tests dieron once verdes y tres rojos; implementar
la proyección corrigió esos tres. Otro test falló porque `application/jsonp` se
aceptaba por una búsqueda parcial del media type; validación exacta y cancelación
del cuerpo lo llevaron a verde. No se atribuye ese ciclo a todos los casos añadidos.

Verificación final de código: 22 tests pasan. Incluye aplicación sin sockets,
validadores, confirmación fallida sin cambios, copias/instancias aisladas, proyección
desactualizada, replay, huecos, contenido contradictorio y validaciones de evento.
Siete casos HTTP observan sockets reales loopback con puerto efímero: traducción,
503 sin retry, JSON/moneda/cuerpo inválidos, redirects sin contactar destino,
timeout, restricciones del harness y media type. No red entre máquinas ni TLS.

El checker usa el AST de TypeScript para imports y reexports estáticos, incluidos
tipos. Seis archivos de módulos contrastados. Casos negativos de acceso privado,
sentido de capa, imports externos y carga dinámica. No prueba pureza: un fetch
global puede escapar al chequeo. No aliases; archivos nuevos requieren revisar
reglas. Una política de imports no es aislamiento de seguridad.

Demo observado: resumen cursor/count/total 0/0/0 antes de entrega y 1/1/500 después.
No mide lag temporal. Los servidores de test se cierran con su cleanup; sin cuentas,
credenciales, llamadas comerciales o datos reales.

## Verificación editorial y sitio

- Cuatro tests estructurales y 58 editoriales cruzados pasan. Índices sincronizados
  de 158 posts, veinte paquetes y los mismos 48 exports estáticos allowlisted.
- Diez snippets ejecutables y un fragmento ADR coinciden con sus fuentes.
- Cinco D2/SVG con alt descriptivo y dimensiones reales comprobadas.
- Build pasa: cincuenta rutas, 61 HTML incluyendo visores, diez páginas publicadas
  indexadas y 4280 palabras Pagefind. Los cinco nuevos posts siguen excluidos.
- Diecinueve tests del blog pasan tras el build, incluidos enlaces, assets y SEO.
- Revisión Chromium: cinco posts en 1440/360, diez vistas. H1/noindex, links 200,
  imágenes cargadas, ausencia de overflow y navegación por teclado comprobadas.
  El primer recorrido detectó overflow de la tabla de P046; se añade el contenedor
  accesible ya utilizado por el blog, sin tocar CSS global. Después pasan las diez
  vistas: `/tmp/architecture-boundaries-layout.QFv8y3/report.json`. Se repite con
  comprobación y captura específica de la región comparativa, no solo de regiones
  de código: `/tmp/architecture-boundaries-layout.J4ZDkz/report.json`, diez vistas
  pasan. Capturas móviles inspeccionadas de puertos, capas, ownership, CQRS y tabla.
  No sumar repeticiones como casos nuevos.

Build final repetido tras corregir la tabla; 19 tests del blog pasan otra vez.
Servidor temporal detenido y puerto 4322 sin listener. Se revierte exclusivamente
el pruning/actualización automática del lockfile del blog causado por pnpm durante
las verificaciones: no se solicitaron cambios de dependencias del sitio.

Enlaces GitHub comprobados contra archivos locales; no se afirma que el remoto de
ejemplos exista o haya sido publicado. No se ejecutan todos los laboratorios previos,
Docker, SQL o Redis para esta ampliación.

## Límites y siguiente bloque

Proveedor ficticio, solo HTTP 127.0.0.1; origen no tomado del lector. Sin Stripe
sandbox, SQL, autenticación, TLS, persistencia, broker o worker autónomo. P045 no
cumple todavía la sustitución comercial de su DoD. P046 compara alternativas y
documenta la decisión educativa, sin despliegue ni medición cloud.

Map y array no demuestran ACID o recuperación. Reporting solo progresa con entrega
manual completa y ordenada; deduplicación/huellas crecen en memoria. No exactly-once,
outbox durable o Event Sourcing. Módulos no son fronteras contra código hostil.

Inventario actual: 56 IDs exactos, 30 relacionados y 89 sin artículo identificado.
No es aceptación de las 175 fichas ni completitud de Serie 05. Siguiente: contrastar
gaps P048/P051 y sus fuentes (replicación/quorum/consenso/CAP/PACELC/streaming),
después Serie 06. Mantener drafts españoles y laboratorio en monorepo separado.
Sin traducciones, audio, publicación o push. El commit solicitado guardó la serie
anterior antes de continuar esta, que queda pendiente de una nueva confirmación.
