# Amenazas de una API multi-tenant

Sandbox **intencionadamente vulnerable** para nueve entregas de P030.
No es un starter de producción ni debe publicarse, exponerse con un túnel o
cambiarse su bind de 127.0.0.1. Solo datos ficticios. Las rutas inseguras viajan
como fuentes dentro de un ZIP; el blog no las monta como endpoints.

## Ejecutar

Node 24.19.0 o posterior y pnpm 12.8.1. Sin dependencias, sin instalación, sin Docker
y sin proveedores externos. La ejecución verificada usó SQLite 3.53.3 incluido en
Node 24.19.0. No utiliza una base de datos existente.

El lockfile conserva la resolución del gestor pnpm 12.8.1 que genera esa versión;
no añade librerías de aplicación. Para evitar incluso el gestor, con el Node
indicado puede ejecutarse directamente `node --test tests/*.test.mjs`.

```bash
pnpm test
pnpm serve
```

serve muestra el origen con un puerto efímero en loopback. Ctrl+C cierra el servidor
y la conexión SQLite en memoria. Se descartan todos los cambios de la ejecución.
El timeout de recepción no es una cuota ni una garantía de resistencia a DoS.

## Alcance del contrato

- Fixture Alice: `Authorization: Bearer demo-alice`, miembro de North.
- Fixture Bob: `Authorization: Bearer demo-bob`, miembro de South.
- Son credenciales públicas de demostración, sin expiración ni autenticación real.
- Miembros leen todos los títulos del tenant. Owner de draft puede cambiar title.
- North tiene d1 de Alice (O'Reilly) y d2 de Bob (Guía de Bob).
- South tiene su propio d1 de Bob (Privado South).
- GET /tenants/north/documents devuelve id y title de North.
- GET /tenants/north/documents/d1 devuelve una representación pública de d1.
- PATCH /tenants/north/documents/d1 admite solo JSON con title.
- GET /tenants/north/search?title=... realiza igualdad exacta, no LIKE.
- `sort=id` o `sort=title` selecciona identificadores SQL fijos en la búsqueda segura.
- `?mode=unsafe` habilita la mezcla indiscriminada en PATCH y concatenación en search.
  `safe` es el valor por defecto; cualquier otro modo da 422.

Las respuestas genéricas no incluyen errores SQL, cabeceras de autenticación o
notas internas. El modo inicial no tiene logger operativo ni rotación de secretos;
la ampliación opt-in de credenciales se describe al final.
Un atacante con acceso a estos fixtures conoce sus credenciales por diseño.

## Archivos y evidencia

| Entrega         | Archivos                                               | Evidencia                                                                                                       |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Threat modeling | threat-model.json, lab.mjs, tests/lab.test.mjs         | T01–T04 iniciales; T05–T07 ampliados en fixtures, con riesgos residuales explícitos                             |
| Mass assignment | command.mjs, store.mjs                                 | Mezcla cambia owner/state; parser title-only rechaza extras sin escribir; UPDATE explícito revalida owner/draft |
| SQL injection   | store.mjs                                              | SQLite real devuelve tres filas en la variante vulnerable; binding literal, tenant y sort comprobados           |
| Visor           | explorer.html, explorer.css, explorer.mjs, command.mjs | Modelo sin red, comparte parser y mezcla; no reproduce SQLite ni autentica                                      |

Las trece pruebas iniciales ejecutan HTTP real, escrituras y lecturas posteriores.
Se añaden catorce pruebas de SSRF/trazas, doce de admisión/modelo y diecinueve de
credenciales/cliente/evidencia; 58 en total. El test de
`__proto__` comprueba una clave rechazada, no una explotación de prototype pollution.
La búsqueda parametrizada sin tenant existe solo como contraejemplo invocado por
el test; no tiene un endpoint independiente. Preparar SQL ya concatenado sigue
siendo vulnerable, aunque se use db.prepare.

El visor es estático, sin llamadas a la API ni eval: representa JSON con textContent.
Su barra cuenta diferencias en tenantId, ownerId y state, no severidad. Cada
comparación parte de un documento nuevo. Para servirlo localmente, usa el servidor
de archivos del blog; pnpm serve solo inicia la API HTTP, no un servidor de assets.

## Límites y continuación

HTTP local sin TLS. Lookup de identidad público, no OIDC, login o MFA. SQLite
síncrono en memoria, sin usuarios SQL, RLS o persistencia. La escritura segura
incluye owner/draft en su WHERE y solo cambia title; dos títulos válidos siguen
last write wins, sin versión optimista o prueba de despliegue multiworker.

La ampliación SSRF reproduce salidas mediante fixtures, como se explica debajo.
La ampliación de admisión aplica cuota y concurrencia locales, sin carga distribuida
o secret manager. Body de 4096 bytes probado; eso solo no cierra consumo. T01
conserva el modo público y añade el verificador opt-in para clientes, no personas.
T05–T07 solo se demuestran en fixture. No es aceptación de una plataforma desplegada:
el alcance de infraestructura sigue **parcial**. P026 conserva su gap de refresh integrado.

No sustituir una auditoría por el recuento de tests. Actualizar el modelo cuando
se añadan rutas, actores o nuevas fronteras de confianza.

## SSRF: destinos, redirecciones y conexión

```bash
pnpm serve:ssrf
node record-ssrf.mjs
```

serve:ssrf inicia la API y dos servicios controlados en loopback. El proveedor
escucha en 127.0.0.1 y el marcador lógico interno en 127.0.0.2, en el mismo puerto
efímero. No se configura una red privada inaccesible para el runner. media.fixture.test
se resuelve con una función inyectada: **resolver programado**, no DNS externo o
cambio de /etc/hosts. No hay librerías de aplicación que instalar.

POST /tenants/north/imports acepta JSON y usa la identidad de fixture ya verificada.
En modo safe, el body solo contiene reference. North admite a1 y los casos de
prueba redirect/large/silent; South admite b1. Sin identidad o con ruta ajena no
hay salidas. North no puede seleccionar b1. No se persiste el texto importado.

Modos exclusivos de la demostración:

- safe: construye destino desde catálogo por tenant, comprueba todos los candidatos
  de resolución, fija la IP aprobada en el lookup del transporte y rechaza redirects.
- unsafe-url: acepta url y sigue redirects sin política de aplicación de destino.
- allowlist-only: exige protocolo y origin inicial exactos, sin credenciales ni fragmento, pero
  sigue un redirect sin autorizar su nuevo destino. No valida todos los paths.
- check-then-resolve: obtiene y comprueba una IP, luego vuelve a resolver al conectar.
  changingResolver permite comprobar la conexión al segundo destino.

El caso blob exige comprobar protocol además de origin: el origin de una URL blob
puede derivarse de la URL interior. La prueba detectó que el parser la aceptaba y
el transporte respondía 500 por esquema no soportado. Ahora se rechaza antes con 403.

Una guardia independiente del harness limita orígenes a los dos fixtures y limita
las direcciones devueltas al transporte a 127.0.0.1/127.0.0.2. Se aplica también a
saltos en los modos vulnerables. Ninguna prueba consulta destinos externos ni metadata
cloud. Esta guardia no equivale a instalar un firewall o aislamiento de red del SO.
La política segura permite solo 127.0.0.1 porque representa al proveedor del fixture:
**no copiar esa política de loopback en producción**.

importer.mjs utiliza node:http con lookup inyectado, agent:false, family:4 y
autoSelectFamily:false. No hay pooling, proxy o TLS. Los tests prueban Host conservado
y ausencia de Authorization/Cookie del usuario en el proveedor, redirect con cero
peticiones internas al rechazar, doble resolución con conexión real y pin sin segunda
consulta. También listas vacías/no admitidas/mixtas, respuesta de más de 1024 bytes y
deadline de 1000 ms que incluye la resolución inicial. Una respuesta tardía del
resolver no continúa al socket. Estos límites no implementan rate limiting.

record-ssrf.mjs ejecuta cinco escenarios y contrasta status/contadores esperados;
guarda ssrf-evidence.json sin puertos efímeros, tiempos inventados o credenciales.
tests/ssrf-evidence.test.mjs vuelve a ejecutarlos y exige eventos y contadores iguales.
El visor ssrf-explorer.html consume únicamente ese archivo estático. Permite avanzar
por los eventos y muestra peticiones recibidas, no latencias ni nivel de riesgo.
Se sirve como asset del blog, no mediante pnpm serve:ssrf.

T05 queda demostrado solo dentro del fixture. Sin servidor DNS real, TTL/cachés,
HTTPS/SNI/certificados, IPv6 de transporte, proxies, reintentos, pooling, firewall o
política general de redes. T06 se amplía con admisión local; T07 con ciclo de
credenciales en memoria, no autenticación de usuarios o infraestructura real.

## Consumo y cuota: admisión local, no un limitador distribuido

```bash
pnpm serve:limits
```

Usa los mismos tres servicios locales y el importador seguro; solo modo safe.
admission.mjs reserva un trabajo por tenant y dos globales por defecto, sin cola.
Cupo local lleno: 429. Capacidad global llena: 503. Retry-After de concurrencia es
un segundo orientativo, no conoce la finalización del trabajo ni reserva puesto.
El finally espera work antes de liberar, incluso ante rechazo/error. Release es
idempotente. El deadline cooperativo del cliente HTTP permite liberar tras 504.
La desconexión del lector de la API no cancela aquí el trabajo del importador.

Cada tenant conocido tiene un token bucket de capacidad cuatro y recarga uno por
segundo. Reloj real del proceso: performance.now. Coste HTTP fijo uno, no lee un
cost del cliente. Cupo se comprueba antes de gastar cuota; fallo dentro del trabajo
no reembolsa el token. Parsing básico/identidad/tenant preceden admisión; el schema
de referencia y proveedor se comprueban dentro del importador, después de gastar.

Las pruebas HTTP inyectan reloj para ráfaga/recarga, y retienen trabajo con promesas
controladas para concurrencia: no son mediciones de CPU, memoria o throughput.
Se prueban ocho rechazos paralelos sin trabajo diferido, South con cupo disponible,
global lleno sin ejecutar, error/deadline que liberan, headers no confiables sin
cambiar clave, y solicitudes anónimas/ajenas que no gastan cuota. Los casos retenidos
tienen timeout de test para detectar regresiones sin esperar indefinidamente.

quota-model.mjs comparte createTokenBucket con el servidor. El visor muestra tiempo
lógico, saldo y admisión; su eje horizontal cuenta intentos de North, no segundos.
No llama a una API o simula concurrencia, y no contiene resultados de carga real.
Los casos se contrastan con saldos/decisiones esperados en tests/quota-model.test.mjs.

T06 demostrado solo en este proceso: sin réplicas, persistencia, límites económicos,
fairness, colas duraderas, aislamiento de CPU o mitigación volumétrica. Identidad de
fixture y HTTP sin TLS. La ampliación siguiente comprueba T07 localmente,
sin sustituir una revisión de autenticación o secretos de infraestructura.

## Credenciales de clientes y rotación, sin claves reales en assets

```bash
pnpm demo:credentials
```

El comando crea y cierra la API con `startLab({identify: identifyClient(credentials)})`.
El adaptador reemplaza al fixture público: no lo usa como fallback si falla el
almacén. credentials.mjs emite claves aleatorias con 32 bytes de secreto, conserva
SHA-256 del token y metadatos, y comprueba caducidad/revocación por solicitud.
No se emiten credenciales por HTTP. No es login de usuarios ni reemplazo de OIDC/MFA.

scopes limitan operaciones sin sustituir tenant/owner/draft. El código público 503
es service_unavailable para capacidad o almacén, no un mensaje con detalles internos.
Authorization ausente/inválida da 401 con desafío Bearer; duplicada se rechaza.

credential-client.mjs usa un GET fijo de lectura a loopback, sin redirects y timeout
HTTP de 1000 ms. readSecret es una fuente inyectada en memoria, no un SDK cloud.
Comprueba la candidata antes de seleccionar, comparte recargas simultáneas, conserva
la anterior ante fallo y no inventa credencial inicial. Revocar/caducar sigue causando
401 aunque haya copia local. Audit síncrono por allowlist; sus fallos se aíslan y no
hay entrega durable. No registra error.message ni token como version.

observe-credentials.mjs ejecuta cinco etapas HTTP: inicio, convivencia, recarga,
revocación y expiración con reloj lógico. demo imprime solo status/eventos. Para
regenerar la proyección sin secretos: `node record-credentials.mjs`. El archivo
credential-evidence.json se contrasta repitiendo conexiones y con expectativas
independientes en tests/credential-evidence.test.mjs. No guarda tokens, digests,
identificadores aleatorios o puertos. Ningún secreto se escribe en el ZIP o en el blog.

T07 demostrado solo en fixture. Sin secret manager, cifrado/persistencia, TLS, varias
réplicas, MFA, limitación de intentos de autenticación o auditoría durable. El cliente
retiene el token en memoria, sin borrado verificable. La fuente no tiene deadline;
una futura implementación remota debe acotarlo. Overlap programado no es contención
ante filtración: puede ser necesario revocar de inmediato aceptando indisponibilidad.
