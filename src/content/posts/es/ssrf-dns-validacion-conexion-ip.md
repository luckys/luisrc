---
id: API-THREATS-DNS
title: 'SSRF y DNS: validar una IP no basta si te conectas después a otra'
published: 2026-10-18T04:27:00Z
locale: es
translationKey: ssrf-dns-validacion-conexion-ip
slug: ssrf-dns-validacion-conexion-ip
draft: true
status: draft
level: intermedio
prerequisites: [API-THREATS-SSRF]
description: 'Reproduce el hueco entre validar DNS y conectar con HTTP real y un resolver de fixture. Fija la IP aprobada, conserva Host y delimita TLS, proxies, pooling y egress.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, ssrf, dns, redes, testing]
---

El código resolvió el nombre del proveedor, comprobó la IP y la consideró permitida. Después entregó el hostname al cliente HTTP, que volvió a resolverlo. La segunda respuesta apuntaba a otro destino y esa fue la dirección utilizada para conectar.

Habíamos validado un dato que ya no controlaba la acción final. Es un hueco de **TOCTOU**, Time of Check to Time of Use: lo comprobado y lo utilizado pueden dejar de coincidir entre ambos momentos.

La [entrega anterior sobre SSRF](/posts/ssrf-destinos-permitidos-redirecciones) limitó referencias y redirects. Ahora seguiremos la decisión hasta el socket. La idea no es guardar una IP para siempre, sino asegurar que cada conexión usa una dirección autorizada para esa operación.

## Un hostname y una dirección IP no son el mismo dato

El hostname identifica el nombre al que queremos acceder. La resolución produce direcciones candidatas con las que el cliente puede intentar conectar. Que el nombre figure en una allowlist no demuestra que todas sus direcciones sean apropiadas para nuestra aplicación.

Un proveedor puede cambiar direcciones legítimamente. También puede haber varias respuestas y mecanismos de fallback. La política debe decidir qué destinos acepta y aplicarse al recorrido real, no solo a una primera respuesta que después se ignora.

Se habla de **DNS rebinding** cuando un cambio de resolución permite asociar un nombre con un destino diferente para cruzar una restricción de confianza. Nuestro test reproduce el mecanismo de doble consulta con un resolver programado, no un servidor DNS atacante ni una medición de cachés o TTL.

Esta distinción importa: controlar exactamente las dos respuestas hace el caso reproducible, pero no demuestra el comportamiento de todos los resolvers, navegadores o redes de producción.

## Dos direcciones de loopback hacen visible el cambio

El proveedor del fixture escucha en 127.0.0.1 y el destino no autorizado en 127.0.0.2, ambos en el mismo puerto efímero. Las dos IP son locales. Permitimos la primera exclusivamente para representar la política del ejercicio; **no es una política de salida para producción**.

La URL conserva el nombre media.fixture.test. No modificamos /etc/hosts ni consultamos DNS externo. Pasamos una función lookup al cliente HTTP de Node. El dominio .test pertenece al espacio reservado para pruebas, y en este laboratorio lo resuelve esa función local.

changingResolver devuelve 127.0.0.1 en la primera llamada y 127.0.0.2 en la siguiente. El modo check-then-resolve comprueba la primera y deja que el transporte haga otra consulta sin repetir la política de destino.

El resultado no es una predicción de un modelo: se abre una conexión HTTP real hacia el segundo servidor. Su registro confirma la dirección local 127.0.0.2 y devuelve INTERNAL-MARKER. El proveedor permitido recibe cero peticiones.

## Resolver una vez, comprobar y fijar la dirección

El camino seguro obtiene los candidatos mediante approvedAddress, en `importer.mjs`:

```javascript
export async function approvedAddress(url, resolve, signal) {
  const records = await abortable(resolve(url.hostname), signal)
  // Política exclusiva del fixture. En producción no se permite este loopback.
  if (
    !records.length ||
    records.some((row) => row.family !== 4 || row.address !== '127.0.0.1')
  )
    throw forbidden()
  return { ...records[0] }
}
```

abortable y forbidden están definidos en ese mismo módulo. La primera función permite abandonar la espera por resolución cuando vence el presupuesto; la segunda produce el error que la API traduce a 403.

La política del fixture rechaza una lista vacía y cualquier candidato distinto de la dirección IPv4 concreta permitida. Si hay una respuesta mixta con ::1, también la deniega antes de crear el socket. No examina una IP aceptable y deja las demás disponibles para un fallback no revisado.

Para una integración real hay que definir redes y tipos de direcciones según el requisito, incluidas representaciones IPv4/IPv6 y destinos especiales. Esta igualdad sirve para dos fixtures conocidos, no reemplaza una biblioteca de direcciones ni una política de egress.

<img src="/assets/visuals/api-contracts/API-THREATS-DNS.svg" alt="La variante de doble resolución aprueba 127.0.0.1 pero conecta a 127.0.0.2 tras una segunda consulta. La variante con pin obtiene y valida una dirección, la entrega al transporte y conecta al proveedor sin resolver de nuevo." width="390" height="1076" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-DNS.svg).

El siguiente extracto muestra la diferencia entre ambos caminos dentro del importador. address ya contiene el candidato aprobado:

```javascript
if (mode === 'check-then-resolve')
  return await exchange(url, nodeLookup(resolve), signal, false)
const pinned = nodeLookup(async (hostname) => {
  if (hostname !== url.hostname) throw forbidden()
  return [address]
})
return await exchange(url, pinned, signal, false)
```

**Pinning**, aquí, significa fijar esa decisión para la conexión. El callback pinned devuelve la dirección ya aprobada; no vuelve a llamar al resolver original. La comprobación del hostname evita reutilizarlo inadvertidamente para otro nombre.

En este ejemplo tampoco seguimos redirects. Si se añadieran, cada nuevo destino necesitaría su propia decisión y su propio binding. El callback de una conexión no autoriza de forma transitiva cualquier otro host.

## Conectar a la IP no obliga a perder el hostname

El cliente conserva la URL original y modifica la resolución usada por el transporte. El proveedor sigue recibiendo Host con media.fixture.test y su puerto, aunque el socket se haya abierto hacia 127.0.0.1. La prueba comprueba esa cabecera y la ausencia de una segunda consulta al resolver.

Esto es distinto de reemplazar a ciegas el hostname de la URL por una IP. En **HTTPS**, el nombre también interviene en SNI y en la comprobación del certificado. Un cliente de producción debe conservar la identidad esperada y validar TLS al conectar a la dirección autorizada.

Nuestro transporte usa HTTP local. No hemos probado SNI, certificados, mTLS o un proxy TLS. Desactivar la comprobación del certificado para que funcione una URL reescrita eliminaría otra defensa; no es la solución que demuestra este laboratorio.

## Pooling, proxies y reintentos pueden cambiar quién decide el destino

En el cliente del ejercicio utilizamos agent:false, family:4 y autoSelectFamily:false. Así observamos una conexión nueva con una selección concreta, sin una caché de sockets o un fallback entre familias que oculte el caso que estamos probando.

No es una recomendación de desactivar pooling en todos los servicios. Reutilizar conexiones puede ahorrar trabajo, pero entonces hay que revisar cómo se estableció y a qué autoridad pertenece cada conexión, y cuándo se vuelve a evaluar la política.

Un proxy añade otra frontera: puede ser él quien resuelva el hostname y abra el socket final. Validar una IP en la aplicación no demuestra que el proxy use esa misma IP. Los reintentos también deben conservar la política, en vez de caer en otra ruta del cliente que resuelva sin comprobar.

La **restricción de egress**, la política de salida de red, aporta una defensa independiente. Puede limitar destinos aunque el código falle. El test no instala un firewall, ni verifica reglas de contenedores o de cloud; su guardia de sandbox solo evita que las variantes de demostración salgan de sus fixtures.

## Las trazas permiten comparar la conexión que realmente ocurrió

Abre el [visor de recorridos SSRF](/assets/interactive/api-ssrf/ssrf-explorer.html) y elige la segunda resolución no comprobada. Avanza paso a paso: aparecen dos respuestas del resolver, ninguna petición al proveedor y una al destino interno.

Después selecciona la conexión fijada. Solo hay una resolución, el proveedor recibe una petición y el destino interno, ninguna. La API devuelve NORTH-A1, no el marcador interno.

Los datos proceden de ssrf-evidence.json. record-ssrf.mjs ejecuta los escenarios para regenerarlos, y una prueba independiente los vuelve a ejecutar. La gráfica no consulta DNS en tu equipo ni intenta conectarse al servicio representado.

## Un deadline y un límite de bytes no autorizan el destino

El importador tiene un presupuesto de 1000 ms que abarca espera inicial por el resolver y petición, y limita la respuesta a 1024 bytes. Son límites elegidos para el fixture, no recomendaciones universales de capacidad.

La prueba con un resolver que no responde termina con 504. Cuando liberamos después su promesa, no se abre una conexión tardía. Abandonar una espera no obliga a que cualquier implementación externa de DNS haya cancelado físicamente su trabajo; sí evita que este flujo continúe hacia el socket.

Otra prueba detectó un error en el límite de bytes: destruir la petición no rechazaba inmediatamente el resultado y podía llegar un 200 con contenido vacío. La corrección rechaza la promesa antes de destruir el request. El test conserva la expectativa 502 para una respuesta demasiado grande.

Esos controles reducen trabajo de una operación, pero una sucesión de peticiones válidas todavía puede agotar recursos. Las entregas siguientes desarrollan por separado [concurrencia](/posts/consumo-recursos-concurrencia-bulkheads) y [token bucket por tenant](/posts/rate-limiting-token-bucket-tenant), con el alcance local de T06, no una garantía universal de disponibilidad.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-dns/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

Consulta el [laboratorio de amenazas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/importer.mjs) y ejecuta `pnpm test` con Node 24.19.0 o posterior. Para regenerar las cinco trazas, utiliza `node record-ssrf.mjs`. No requiere paquetes de aplicación.

Hay sockets y servidores HTTP reales, pero el resolver es una función programada. No se configura un servidor DNS, una red aislada, HTTPS, proxy, pooling, Happy Eyeballs o un filtro de todas las redes públicas. Las dos IP permitidas por la guardia del harness son locales y su puerto debe pertenecer a los fixtures.

El bloque cubre T05 dentro de ese alcance. T06 se amplía después con límites locales; autenticación y secretos reales siguen pendientes. La identidad pública del test tampoco cierra el gap de refresh del RP OIDC anterior ni completa P030.

## Ejercicio: revisar el fallback sin ampliar permisos

Añade un resolver que devuelve dos candidatos y escribe primero qué resultado esperas si uno no está permitido. Comprueba cuántas conexiones recibió cada destino, no solo cuántas veces se llamó a resolve.

Si decides permitir varios candidatos, exige que todos los intentos y reintentos seleccionen únicamente direcciones aprobadas. Anota en el threat model qué componente conserva esa decisión cuando introduzcas un pool o un proxy.

## Referencias

- [OWASP: SSRF y controles de resolución y conexión](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- [Node.js: cliente HTTP, lookup y opciones de conexión](https://nodejs.org/api/http.html).
- [Node.js: DNS y diferencias entre lookup y resolve](https://nodejs.org/api/dns.html).
- [Node.js: HTTPS y servername](https://nodejs.org/api/https.html).
- [RFC 6761: dominio reservado .test](https://www.rfc-editor.org/rfc/rfc6761.html#section-6.2).

Fuentes consultadas el 19 de octubre de 2026. La ejecución verificada usa Node 24.19.0; la documentación enlazada puede mostrar una versión posterior.
