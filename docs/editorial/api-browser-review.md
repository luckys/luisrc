# P029: cuatro preguntas, cuatro artículos

## Revisión de las tres entregas anteriores

Commit previo a esta continuación: `ed7a5b3`, P028 y laboratorio de permisos.
Se revisaron íntegramente sus tres artículos después de guardar el trabajo:

| Entrega               | Pregunta central                                   | Decisión                                                                                                              |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| RBAC/ABAC/ownership   | ¿Qué combinación permite una acción?               | Conservar: las tres ideas se aplican a una sola política pequeña y función pura. Separarlas ocultaría su interacción. |
| Contexto multi-tenant | ¿Cómo conservamos el ámbito hasta leer y escribir? | Conservar: listas y mutaciones siguen la misma frontera; SQL/concurrencia solo delimitan lo no demostrado.            |
| Tests BOLA            | ¿Cómo probamos denegación sin efectos?             | Conservar: fixture, positivo y lectura posterior son partes del mismo método de prueba, no tutoriales independientes. |

No se decidió por un umbral de palabras. Se valoraron objetivo, cambios de modelo,
cantidad de mecanismos nuevos y posibilidad de completar un ejercicio concreto.
El laboratorio ya permite profundizar sin pegar todos sus archivos en cada entrega.
No hay un motivo pedagógico suficiente para fragmentarlos más ahora.

## División preventiva de navegador

P029 sí reúne fronteras diferentes. Se escribe como cuatro drafts, no un resumen
enciclopédico ni cuatro IDs nuevos del catálogo:

1. **P029, DOM XSS:** source/sink, texto frente a HTML y límites de HttpOnly/storage.
2. **API-BROWSER-CSP:** nonce, directivas, enforce/Report-Only y HTML todavía inyectado.
3. **API-BROWSER-CSRF:** envío automático, site/origin, cookie y mutación con token/Origin.
4. **API-BROWSER-CORS:** SOP, lectura, petición simple, preflight y autorización separada.

Cada artículo tiene una pregunta, diagrama, observación propia, límites y ejercicio.
No se incluyen SQLi/SSRF/rate limiting: corresponden a P030. No se publica, traduce
ni genera audio. Se conserva la URL del resumen anterior y se añaden enlaces de
profundización, sin renombrar su ID para aparentar avance.

## Criterio permanente para las siguientes entregas

Antes de redactar cada bloque, valorar explícitamente si conviene dividirlo. Dividir
cuando una parte cambia de problema, mecanismo o laboratorio y puede desarrollar
su propia explicación y ejercicio. Mantener juntas las piezas necesarias para
entender una decisión de principio a fin. Un post corto no debe ser un índice de
definiciones; un post detallado no necesita incorporar todos los temas vecinos.

La ruta y el manifiesto deben mantener el orden y los prerrequisitos. Los IDs de
partes no sustituyen fichas originales ni aumentan artificialmente su aceptación.

## Laboratorio y desarrollo

`https://github.com/luckys/luisrc-blog-examples/blob/main/packages/browser-security`, Node 24.19.0, pnpm 12.8.1 y Playwright 1.56.1 fijado en
lockfile independiente. Solo loopback y datos ficticios, sin cuentas o servicios.
Tests HTTP escritos antes de lab.mjs: primera ejecución roja por módulo inexistente.
Una prueba adicional con 48 caracteres no ASCII detectó un 500 de timingSafeEqual
por longitud de bytes diferente. Se corrigió validando los 48 dígitos hexadecimales
antes de comparar, y se conserva el caso con expectativa 403.

Siete tests HTTP y ocho Chromium pasan. Las pruebas de navegador no interceptan
peticiones: el primer intento con routing alteraba el comportamiento observado de
preflight. Se quitó la interceptación, manteniendo expectativas de OPTIONS y PATCH;
se observan las URL para exigir solo destinos de los servidores locales. No se
presenta esa observación como aislamiento de red del sistema.

Evidencia: marcador XSS ejecutado, corrección literal con cero img; HttpOnly oculto
pero petición autenticada y storage ficticio accesibles al XSS; enforce conserva img
y bloquea handler, report lo ejecuta; formulario same-site usa Lax, POST cross-site
no la lleva; token válido permite y entradas falsas deniegan sin efectos; CORS
deniega lectura aunque POST cambie estado; preflight denegado no envía PATCH;
allow exacto permite lectura, wildcard con include no; Node autenticado lee sin CORS.

## Límites que no se deben perder

HTTP sin Secure, fixture `/session` abierta, Map efímero, puertos sin aislamiento de
cookies, todos los servicios bajo control del test. Sin rich text sanitizado, SRI,
Trusted Types, colector de informes, cookies de terceros, otros navegadores,
proxies/CDN o configuración desplegada. Las rutas vulnerables solo van en un ZIP
de fuentes para ejecutar localmente, no se montan como endpoints del blog.

La integración de refresh con el RP OIDC de P026 sigue pendiente. Este laboratorio
no integra identidad ni permisos de los bloques anteriores. P030/P031 pendientes.

## Comprobaciones editoriales y visuales

- `node --test tests/*.test.mjs`: 67 tests pasan; incluye dos nuevos de metadatos,
  enlaces, extractos reales, diagramas y nueve archivos exactos del ZIP.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/luisrc-blog-playwright pnpm --dir https://github.com/luckys/luisrc-blog-examples/blob/main/packages/browser-security test`:
  15 tests pasan, siete HTTP y ocho Chromium. No se suman ejecuciones repetidas.
- ZIP extraído a una carpeta temporal, `pnpm install --frozen-lockfile --ignore-scripts`
  y los mismos 15 tests: pasan también fuera del checkout. La última modificación
  del ZIP solo aclara el ejemplo de consola del README usando location.origin;
  módulos, lockfile y tests son los mismos verificados en esa extracción.
- `pnpm build`: 48 rutas estáticas, 54 HTML contando recursos públicos; Pagefind
  sigue indexando ocho páginas publicadas y 4104 palabras.
- Los 23 drafts API no se emiten como HTML de posts, Markdown de posts o entradas
  de llms.txt. ZIP público y ZIP en dist idénticos.
- `scripts/check-api-contracts-browser.mjs`: 46 vistas, 23 artículos a 1440 y 360 px,
  sin overflow de página, imágenes cargadas, enlaces locales correctos, noindex y
  sin errores JS/KaTeX. Se mantienen los cinco casos del visor de paginación y
  los siete de permisos. Informe: `/tmp/api-contracts-layout.TqUDEo/report.json`.
- Se inspeccionaron las cuatro capturas móviles de los diagramas nuevos: texto
  legible y contenido dentro del ancho. Las figuras largas pueden ocupar más de
  una pantalla, con enlace para ampliarlas. No se afirma una auditoría visual de
  todos los estados o navegadores.
- Prettier y `git diff --check` sin incidencias. Servidor de desarrollo temporal
  cerrado después de la revisión.

Los cuatro artículos nuevos y esta continuación quedan sin commit posterior a
`ed7a5b3`. No hay push, publicación, traducciones o audios nuevos.
