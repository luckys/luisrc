# Computación, sistemas y redes

Laboratorio de P001–P009. Node 24.19.0, OpenSSL 3 y Linux con `ps`, `ss` e `ip`
ya disponibles. Los módulos usan solo bibliotecas estándar de Node. No requiere
instalación de paquetes. Playwright/Chromium se usan aparte para la prueba de navegador.

## Ejecutar y comprobar

Desde esta carpeta, también después de extraer el ZIP:

```sh
node --test tests/*.test.mjs
node experiments.mjs
```

El segundo comando imprime una nueva observación; no reemplaza los archivos
archivados. Las duraciones, PID, uso de memoria y material de sesión TLS pueden variar.
No se espera igualdad de tiempos entre máquinas. Sí deben conservarse los contratos
de las pruebas: checksum, orden de eventos, rechazos de TLS, DNS y respuestas HTTP.

Los fixtures escuchan solo en 127.0.0.1 y puertos efímeros. Los procesos son hijos
creados por el laboratorio. Nunca cambia la configuración DNS, el trust store,
firewall o procesos ajenos. Los ficheros temporales conocidos se eliminan al terminar.
Las claves privadas TLS no se guardan en el repo ni en el ZIP.

## Qué reproduce cada ficha

| Ficha | Código y resultado |
| --- | --- |
| P001 | concepts.mjs y memoryExperiment: checksum de 2 MiB, nueve muestras y caché LRU conceptual |
| P002 | minorUnits/representation: float decimal, BigInt desde texto, UTF-8 fragmentado e instantes con offset |
| P003 | process-probe.mjs: CPU y memoria antes/después de un Buffer; bloqueo síncrono acotado |
| P004 | service.mjs y linuxExperiment: confirmar hijo con ps/ss, HTTP 200 y SIGTERM |
| P005 | dnsExperiment: resolver independiente hacia DNS UDP local, TTL y ruta loopback |
| P006 | transport: modelo de entrega ordenada/datagramas con pérdida y deadline |
| P007 | tlsExperiment: certificado temporal, confianza explícita y nombre esperado |
| P008 | http-server.mjs: ETag y secuencia 200/304/200 tras cambio |
| P009 | browser-server.mjs: navegación, cookie HttpOnly, Fetch y long task en navegador real |

## Abrir el simulador dinámico

Desde esta carpeta:

```sh
node browser-server.mjs
```

Este comando abre el fixture de navegación y muestra su URL local. Para el simulador
de transporte, sirve los archivos estáticos con un servidor local, por ejemplo:

```sh
python3 -m http.server 4401 --bind 127.0.0.1
```

Abre http://127.0.0.1:4401/transport.html. Funciona con JavaScript nativo; no usa
servicios externos. Las tres curvas y la tabla se actualizan al cambiar los controles,
que también admiten teclado. No abrir con file://: los módulos necesitan HTTP.
Detén los servidores con Ctrl+C al terminar. Python solo sirve ficheros; no instala nada.

El servidor de browser-server.mjs usa una cookie con valor literal `fake`; no es un
sistema de autenticación. La CSP permite conexiones a otros puertos loopback para
la prueba CORS. Esa configuración y el endpoint no deben desplegarse en producción.

## Evidencia y límites

results/experiments.json conserva entorno, muestras y resultados. Fichero recién
escrito y calentado: page cache probable, no benchmark de SSD ni latencia de RAM.
El simulador de transporte no implementa TCP/UDP/QUIC, retransmisión real o congestión.
La caché LRU tampoco emula una CPU específica.

results/browser.json contiene una traza real de Chromium con Navigation Timing,
marcas y Long Tasks. El segundo servidor recibe una cookie, pero CORS bloquea la
lectura de su respuesta en el primer origen. No es una prueba de autenticación real.

## Herramientas del blog

Desde la raíz del blog, reutilizando sus dependencias pnpm existentes:

```sh
node scripts/check-computing-browser.mjs
node scripts/render-computing-series.mjs
node scripts/package-computing-series.mjs
```

La prueba de navegador reutiliza @playwright/test del laboratorio frontend. El ZIP
no incluye ese navegador ni Playwright: también puedes abrir el fixture manualmente.
Para renovar explícitamente la traza archivada, añade `--record` al checker.

`node scripts/calculate-computing-series.mjs` reemplaza las observaciones archivadas.
Úsalo solo al renovar la evidencia y revisar después las cifras de los artículos.
No regenerar resultados para ocultar una regresión. Formatear y sincronizar extractos:

```sh
node scripts/sync-computing-snippets.mjs
```
