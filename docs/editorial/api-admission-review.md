# P030: concurrencia y cuota temporal en entregas distintas

## Reanudación y decisión editorial

El turno anterior fue progreso: dos artículos SSRF con sockets/trazas probados,
diagramas y visor. Estado comprobado al retomar: ed7a5b3, avances P029/P030 sin
commit. No se crean commits o push en esta continuación automática.

Se conserva la división anterior por fronteras. T06 se desarrolla ahora en dos
drafts específicos, no en una lista general de todos los recursos que existen:

1. API-THREATS-CAPACITY: trabajo activo, cupos de tenant/global, rechazo sin cola,
   release idempotente, finally y cancelación cooperativa. Explican una sola reserva.
2. API-THREATS-RATE: burst/recarga, reloj, coste, clave por identidad, Retry-After y
   límites distribuidos. Separar algoritmo y cabecera en otros posts escondería
   la misma decisión de admisión; mezclarlo con concurrencia confundiría presupuestos.

Siete entregas P030, treinta en toda la ruta API, sin nuevas fichas del catálogo.
Todos español/draft, autor Luis Ramírez Calle. Sin inglés, audio o publicación.
Fuentes primarias: OWASP API4/DoS, RFC 6585/9110 y Node performance.now. No se presentan
los valores elegidos como recomendaciones de capacidad o resultados de un benchmark.

## Desarrollo y pruebas

Tests de admisión escritos antes: rojo por admission.mjs inexistente. Once tests de
código/adaptador y uno de modelo se añaden a los 27 previos, 39 en total. Los casos
HTTP usan reloj inyectado para cuotas y promesas controladas para retener trabajo;
el deadline prueba además el cliente HTTP de salida real y su finally.

Pruebas: cupos por tenant/global, release idempotente, ráfaga cuatro, recarga parcial,
coste dos en función pura, techo, reloj retrasado, parámetros inválidos, ocho rechazos
simultáneos sin trabajo diferido, South con capacidad disponible, global lleno sin
ejecución, error/deadline que liberan, cuota consumida por intento admitido aunque
falle, headers X-Forwarded-For/X-Tenant sin cambiar clave, anónimo/tenant ajeno sin gasto.
Los tests retenidos tienen timeout y limpieza para no quedar colgados ante una regresión.

Integración opt-in con startLab({importer,admission}); serve:limits usa el importador
seguro y no admite modos inseguros. serve:ssrf mantiene los casos previos sin admisión,
para que sus pruebas reproduzcan SSRF sin mezclar otra política. Body acotado y
validación de identidad/tenant preceden admisión; schema de referencia/proveedor
se valida dentro del importador, después de gastar el token. Coste HTTP uno fijo.

Se comprueba cupo antes de cuota, sin await al reservar. El await de work permanece
dentro del try/finally. No se devuelve token por fallo del trabajo; sí se libera cupo.
429 para exceso del tenant/cuota y 503 para capacidad compartida. Retry-After temporal
redondea hacia arriba; el de concurrencia es orientativo de un segundo, no reserva.

El check de extractos detectó un desajuste por coma final al formatear Math.min:
se sustituyó el fragmento por el método take completo real, sin debilitar el check.
El vínculo de amenaza a test admite saltos de línea de formato en la llamada test;
sigue exigiendo el tag del escenario, no se presenta como prueba funcional por sí solo.

## Recursos visuales

Dos diagramas verticales D2/SVG. Gráfica dinámica de saldo observado de North y
lista equivalente con timestamp lógico, tenant, decisión, saldo y espera. Eje X es
orden de intentos de North, no segundos. quota-model comparte algoritmo con la API
y se contrasta con saldos/decisiones independientes. No llama a una API, ni simula
concurrencia, ni convierte tiempos lógicos en mediciones reales. Controles por teclado.

## Límites y continuación

T06 demostrado solo en fixture de un proceso. No load test, CPU/memoria medidos,
cuotas económicas, infraestructura distribuida, fairness, colas duraderas o mitigación
volumétrica. No se cancela por desconexión del lector; el cupo sigue ocupado hasta
terminar el importador o su deadline. Tokens/procesos no persisten y se reinician llenos.
Identidad pública y destinos locales sin TLS, no configuración de producción.

T07 permanece pending: broken auth/secretos necesitan sus propias entregas/pruebas.
P026 mantiene el gap de refresh integrado con RP. Después seguir P031 por pequeñas
preguntas de integración. El objetivo editorial completo continúa activo, no probado.

## Verificación final

- `pnpm build`: pasa, 48 rutas estáticas y 57 HTML contando recursos públicos.
  Pagefind conserva ocho páginas publicadas y 4104 palabras, sin indexar los drafts.
- `node --test tests/*.test.mjs`: 71 tests pasan sobre el build terminado. P030
  contrasta siete drafts, once extractos reales, dimensiones, enlaces, riesgos
  pendientes/cubiertos y bytes del ZIP y recursos; no se exige longitud artificial.
- `pnpm --dir examples/api-amenazas test`: 39 tests pasan. ZIP extraído a una carpeta
  independiente y `pnpm test`: los mismos 39 pasan sin instalación de librerías.
  No se suman repeticiones como pruebas adicionales.
- ZIP con 31 archivos allowlisted, sin bases persistidas, claves o instalaciones.
  Cinco archivos del visor de cuota son copias exactas de las fuentes probadas.
- Los treinta drafts API no se emiten como HTML de posts, Markdown de posts o
  entradas llms.txt. ZIP y los cinco archivos de cuota en dist son idénticos a public.
- `pnpm serve:limits`: arranca; North/a1 y South/b1 devuelven 200 y el modo inseguro
  devuelve 422. Ctrl+C cierra limpiamente con exit 0, sin dejar los tres servicios.
- Chromium: 60 vistas de treinta artículos a 1440 y 360 px, más cinco visores.
  Sin overflow de página, errores JS/KaTeX, imágenes sin cargar o enlaces locales
  rotos; noindex conservado. Informe `/tmp/api-contracts-layout.NcxBrM/report.json`.
  El visor de cuota prueba ráfaga, recarga fraccionaria, tenants, ritmo sostenido,
  capacidad, recarga, reset y range por teclado; saldos y puntos contrastados.
- Inspección visual de los dos SVG móviles y de quota-burst-mobile.png: diagramas
  legibles, gráfica dentro del ancho y lista con la misma información en texto.
  El eje declara intentos de North, no tiempo; las decisiones de reloj lógico no
  se presentan como resultados medidos de tráfico HTTP.
- Astro temporal pid 1964663 detenido después de revisar; status confirma que no
  queda un servidor de desarrollo ejecutándose. Formato y diff sin incidencias.

Cambios nuevos y previos P029/P030 sin commit, sobre ed7a5b3. Sin push/publicación.
Objetivo completo activo y no demostrado: T07/broken auth/secretos y P031 siguen,
además del gap P026 y el resto del roadmap. No cerrar por contar artículos o tests.
