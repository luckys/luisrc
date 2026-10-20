# Revisión: Computación, sistemas y redes

Fecha: 18 de octubre de 2026. Autor: Luis Ramírez Calle. Nueve artículos P001–P009,
solo español y draft. La entrega recupera el bloque inicial del catálogo general;
no sustituye las 175 fichas por la ruta abreviada para proyectos.

## Contenido y decisiones editoriales

9.983 palabras contando metadatos y código, entre 1.037 y 1.206 por archivo.
Orden de lectura en ruta-computacion-redes.md; objetivos y errores a evitar en
computing-series-scope.md; inventario en computing-series.json.

Cada artículo parte de un problema concreto, explica mecanismo y alternativas,
identifica el archivo del ejemplo, delimita garantías y propone un ejercicio.
Términos ingleses definidos y conceptos destacados sin poner en negrita todo el texto.
No hay anécdotas inventadas, claims de velocidad universal o dependencias de una empresa.

Recursos: nueve D2/SVG, tres gráficas ECharts desde resultados archivados, simulador
HTML/JS de transporte y laboratorio descargable de dieciséis archivos. El simulador
ofrece controles de teclado, resumen textual y tabla de valores además de curvas.
No es una implementación de TCP/UDP/QUIC y lo declara en la propia interfaz.

Se eligió JavaScript nativo de Node/navegador para observar sus APIs y runtime sin
framework ni instalación. No se presenta como backend productivo, ni como proyecto
TypeScript estricto. La serie posterior de fundamentos de código desarrollará el
contrato de tipos; este laboratorio verifica comportamiento en ejecución.

## Evidencia ejecutada

- `node --test https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/tests/*.test.mjs`: doce pruebas aprobadas.
  Checksum, localidad, muestras reales, cantidades exactas, UTF-8, bloqueo de CPU,
  servicio hijo y cierre, DNS→HTTP, modelo de transporte, fallos TLS y ETag.
- `node --test tests/*.test.mjs`: 48 pruebas aprobadas, seis nuevas para esta serie.
  Metadatos/DAG, enlaces/visuales, extractos, ZIP, coherencia de resultados y copia
  pública del simulador. El resto es regresión de entregas anteriores.
- **60 tests distintos** en estas dos suites. Las repeticiones del ZIP no se suman.
  No se han vuelto a ejecutar todas las integraciones de PostgreSQL/Redis, los
  modelos de ML o la batería completa del laboratorio frontend anterior.
- Se escribieron los tests del laboratorio antes de los módulos y se observó rojo
  por concepts.mjs ausente. La prueba de navegador se creó también antes de su
  servidor y detectó la ausencia del módulo. Después pasó contra el fixture real.
- `node scripts/check-computing-browser.mjs`: Chromium con Navigation Timing,
  microtask antes de DOMContentLoaded, Fetch con cookie ficticia HttpOnly,
  cookie no legible por JS, storage legible, respuesta cross-origin bloqueada por
  CORS aunque el servidor recibió cookie, y long task por bloqueo acotado de 80 ms.
- `node scripts/check-computing-drafts.mjs`: nueve páginas, dos fórmulas KaTeX,
  catorce recursos accesibles, noindex, navegación 1/9–9/9 y anclas de TOC válidas.
- `node scripts/check-computing-layout.mjs`: dieciocho vistas en Chromium a 1440 y
  360 px, veinticuatro cargas de imágenes, sin overflow global ni pageerror.
  Cuatro casos del simulador: inicio, recuperación cero, latencia máxima y deadline
  máximo. El cambio se realiza con teclado y se comprueba el resumen calculado.
- ZIP extraído en `/tmp/computing-zipcheck.NgZYxG`: las doce pruebas funcionan desde
  la copia aislada, sin imports del proyecto padre o paquetes instalados.
- `pnpm build`: 48 rutas Astro y 50 HTML incluyendo los dos exploradores estáticos
  acumulados. Pagefind sigue indexando ocho posts publicados y dos idiomas. Los
  nueve artículos nuevos no se generan como páginas públicas.
- `git diff --check`: sin problemas. Sin cambios de dependencias o lockfiles,
  traducciones, audios, publicación, commit o push nuevos.

## Qué se midió y qué se calculó

P001: fichero de 2 MiB, patrón byte i % 251, checksum 262139206, tres calentamientos
y nueve muestras con orden alternado. Medianas locales: 8,36 ms Buffer; 11,85 ms
lectura/proceso. Node 24.19.0, Linux x64, Intel Core Ultra 9 285H; datos completos en
results/experiments.json. Sin aislar page cache, JIT, frecuencias u otras cargas.
No son latencias de SSD/RAM ni contadores de caché de CPU.

Localidad: modelo fully-associative LRU con cuatro líneas de cuatro posiciones,
128 accesos; 32 misses frente a ocho al reagrupar usos. Modelo, no hardware observado.
P002: float 0,30000000000000004, BigInt exacto desde texto, UTF-8 de España en siete
bytes y reconstrucción de ñ al separar C3/B1 entre chunks; instantes equivalentes.

P003: hijo propio con Buffer de 8 MiB; before/after de memoria y CPU en microsegundos.
Timer observado a unos 80,27 ms tras trabajo síncrono, orden de eventos comprobado
sin exigir una duración exacta. P004: ps/ss confirman hijo/socket, respuesta 200,
eventos ready/request/shutdown y código cero tras SIGTERM al handle del propio hijo.

P005: DNS UDP en loopback con resolver independiente; lab.test devuelve 127.0.0.1
y TTL 30; dos consultas reales. `ip route get` confirma lo y la dirección resuelta
se utiliza en una conexión HTTP propia que devuelve 200 y versión uno. Esta última
observación se añadió sin regenerar las muestras temporales ya explicadas en P001.
No se cambiaron resolvers del sistema ni se capturó tráfico de terceros.

P006: seis unidades, intervalos 20 ms, latencia supuesta 40, recuperación supuesta
100 y deadline relativo 80; tres entregas ordenadas tardías, una pérdida de datagrama
y cinco entregas de datagrama en plazo. No modela ACKs, ventanas o congestión.

P007: certificado/clave temporal de OpenSSL, no empaquetados; emisor no confiable
DEPTH_ZERO_SELF_SIGNED_CERT y nombre incorrecto ERR_TLS_CERT_ALTNAME_INVALID.
Con confianza y nombre local correctos: authorized=true, TLSv1.3 y SAN localhost.
No se desactiva verificación ni se modifica el trust store. P008: 200/304/200,
cuerpo 304 vacío y ETags distintos tras cambiar la representación.

P009: results/browser.json conserva navegación y eventos reales de Chromium 141,
long task observada de 81 ms y comprobaciones cookie/CORS. El clic sucede después
de cargar; la gráfica no atribuye ese hueco al servidor. Los scripts de QA no
sobrescriben esta realización sin --record.

## Inspección visual e incidencias

Revisados los doce SVG como PNG en `/tmp/computing-visuals.nw82YV`. Se separó el flujo
de lectura/page cache del acceso a cachés CPU para no presentarlos como una sola
jerarquía. El diagrama del navegador muestra ramas de modificación e inicio de Fetch,
no una secuencia universal HTML→JS→red. No se observan etiquetas solapadas o recortadas.

Capturas de P008 en `/tmp/computing-layout.lPTVoO/post-1440.png` y `post-360.png`;
simulador en transport-360.png; report.json conserva medidas de viewport. Son QA
temporal, no una certificación completa de accesibilidad o visual regression.

El sincronizador de snippets falló primero por la indentación del cliente TLS tras
formatear. Se corrigió el delimitador, se deduplicó la indentación y ahora valida
todos los extractos antes de escribirlos. Los tests siguen comparándolos con las
fuentes ejecutadas. Una frase de P009 se corrigió para que no pareciese prometer
ausencia de XSS. No se debilitaron checks para ocultar defectos.

La revisión automática de algunas llamadas de lectura del terminal caducó. Se
continuó la lectura por el lector disponible y el reintento acotado de Git funcionó;
las pruebas y build terminaron después con normalidad. No hubo rechazo de seguridad
ni se borraron cambios para recuperar el entorno.

## Fuentes y límites pendientes

Fuentes primarias consultadas el 18 de octubre de 2026: Linux Kernel, man-pages,
OSTEP, Node 24.19.0, ECMAScript, Unicode 17, RFCs de DNS/NAT/TCP/UDP/QUIC/TLS/PKI/
HTTP, HTML/Fetch y W3C Navigation Timing/Long Tasks. Las variantes HTML de RFC 768
y 9110 resolvieron fallos de lectura de sus páginas wrapper y se enlazan directamente.
Sin citas largas ni tablas de rendimiento tomadas de terceros.

No hay benchmark frío del dispositivo, trazado de switches del kernel, NAT real,
DNS recursivo completo, stacks TCP/QUIC nuevos, PKI productiva, HTTP/2/3 medido o
autenticación real. No se han probado Safari/Firefox o lectores de pantalla. Los
ejemplos de importes/fechas tienen contratos deliberadamente pequeños.

El objetivo global sigue incompleto: 38 IDs con borrador, 44 fichas solo relacionadas
y 93 sin artículo identificado. Estos contadores no certifican aceptación del temario.
La siguiente unidad editorial es Serie 02 P010–P019, seguida de ampliaciones de las
series 03–06 y las series avanzadas. No marcar el objetivo completo por este build.
