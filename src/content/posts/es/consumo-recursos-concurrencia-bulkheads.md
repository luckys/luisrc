---
id: API-THREATS-CAPACITY
title: 'Consumo de recursos: limitar trabajo activo sin crear una cola infinita'
published: 2026-10-18T04:28:00Z
locale: es
translationKey: consumo-recursos-concurrencia-bulkheads
slug: consumo-recursos-concurrencia-bulkheads
draft: true
status: draft
level: intermedio
prerequisites: [P030, API-THREATS-DNS]
description: 'Limita operaciones activas por tenant y capacidad compartida. Prueba rechazo antes del trabajo, liberación de cupos y cancelación cooperativa sin confundirlo con rate limiting.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, concurrencia, multi-tenant, testing]
---

La importación de North lleva tiempo esperando al proveedor. Llegan más solicitudes y la API las acepta, aunque ninguna de las anteriores haya terminado. El body de cada una es pequeño y todas pertenecen a usuarios válidos. Aun así, el trabajo pendiente sigue creciendo.

El problema no está necesariamente en una entrada malformada. También necesitamos decidir cuánto trabajo puede mantener activo el servicio y qué hacer cuando se llena. Encolar todo sin límite solo cambia el lugar donde consumimos memoria y tiempo.

Después de [controlar el destino de una conexión saliente](/posts/ssrf-dns-validacion-conexion-ip), seguimos con T06 del threat model: consumo de recursos por solicitudes permitidas. Aquí nos centraremos en concurrencia. El límite de solicitudes a lo largo del tiempo tendrá su propio artículo.

## Una operación válida también consume un presupuesto

**Consumo de recursos** incluye CPU, memoria, conexiones, almacenamiento, tiempo de dependencias y costes de servicios externos. Autenticar a una persona o validar su JSON no establece cuánto puede gastar de cada recurso.

En nuestro ejemplo, el cliente de importación ya limita su respuesta a 1024 bytes y utiliza un deadline de 1000 ms que incluye resolución y petición. La API limita el body entrante a 4096 bytes. Son decisiones del fixture, no valores recomendados para todos los productos.

Cada control responde a una pregunta distinta. El límite de bytes acota cuánto almacenamos de esa entrada o respuesta. El deadline evita que una operación espere indefinidamente. Ninguno limita por sí solo cuántas operaciones pueden coexistir.

Si una búsqueda admite un pageSize arbitrario o una petición desencadena miles de tareas, también hay que acotar esa expansión. El tamaño del JSON puede ser diminuto y el trabajo resultante, enorme. No usamos el número de peticiones como una medida universal de coste.

## Un bulkhead pone un límite al trabajo que sigue vivo

Un **bulkhead** divide capacidad para que un consumidor o una dependencia no ocupe todo sin restricciones. El nombre viene de los compartimentos de un barco, pero aquí lo importante es qué recurso contamos y cuándo dejamos de contarlo.

Contaremos importaciones cuya función todavía no ha terminado. No contamos sockets entrantes, usuarios conectados ni threads del sistema operativo. Una petición puede utilizar varios de esos recursos y no son unidades equivalentes.

La configuración de la demo permite una importación activa por tenant y dos en total. Con una de North retenida, otra de North se rechaza antes de ejecutar su trabajo. South aún puede empezar si queda capacidad compartida.

Esto limita la interferencia de North, pero no reserva un puesto para South ni garantiza fairness. Si el límite global fuera uno y North lo ocupara, South tendría que esperar fuera o recibir un rechazo. La política necesita expresar esa decisión en vez de prometer un aislamiento que no ofrece.

<img src="/assets/visuals/api-contracts/API-THREATS-CAPACITY.svg" alt="La API verifica identidad y tenant, reserva un cupo local y comprueba capacidad global antes de iniciar una importación. Si no hay capacidad rechaza sin encolar. Si la hay ejecuta y libera el cupo en finally cuando el trabajo termina o falla." width="328" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-CAPACITY.svg).

## Reservar y liberar es una sola responsabilidad

El método acquire de `admission.mjs` pertenece al objeto devuelto por createBulkhead. active contiene los tenants conocidos y sus contadores; total y los límites viven en el mismo closure:

```javascript
    acquire(tenantId) {
      if (!active.has(tenantId)) throw failure(403)
      if (active.get(tenantId) >= perTenant) throw failure(429)
      if (total >= globalLimit) throw failure(503)
      active.set(tenantId, active.get(tenantId) + 1)
      total++
      let released = false
      return () => {
        if (released) return
        released = true
        active.set(tenantId, active.get(tenantId) - 1)
        total--
      }
    },
```

Primero comprueba las condiciones y después incrementa ambos contadores. No hay un await entre comprobar y reservar. En este único proceso de Node, otra tarea no interrumpe ese tramo síncrono para reservar el mismo último cupo.

La función devuelta libera exactamente la reserva que se acaba de hacer. Es **idempotente**: llamarla dos veces no reduce el contador dos veces. La prueba lo comprueba porque un total negativo acabaría permitiendo más trabajo del configurado.

Este razonamiento no se extiende a varios procesos. Dos réplicas con sus propios contadores pueden admitir el doble de trabajo. Un límite compartido necesita otra coordinación y otra evidencia.

## Un finally prematuro también rompe el límite

La admisión combina la reserva con la cuota temporal que explicaremos después. Este método es código real de createAdmission:

```javascript
    async run(tenantId, work) {
      const release = bulkhead.acquire(tenantId)
      try {
        const decision = buckets.get(tenantId).take()
        if (!decision.allowed) throw failure(429, decision.retryAfter)
        return await work()
      } finally {
        release()
      }
    },
```

El await dentro del try tiene una función concreta. El cupo debe seguir ocupado mientras work esté pendiente. Devolver su promesa sin esperarla dentro de ese bloque permitiría ejecutar finally y liberar antes de que la operación hubiera terminado.

También necesitamos liberar al fallar. Un error del proveedor no debería dejar un puesto ocupado para siempre. La prueba provoca un 502 y comprueba que el contador vuelve a cero; otra retiene la operación y exige que el contador siga en uno hasta resolverla.

La cuota temporal y el cupo tienen vidas distintas. Un token gastado al admitir una solicitud no se devuelve porque el proveedor falle. En cambio, el cupo activo sí se libera cuando ese intento termina.

## Rechazar sin cola es una decisión funcional, no un accidente

Este controlador no mantiene una lista de solicitudes esperando su turno. Si el tenant agota su cupo responde 429; si agota la capacidad global responde 503. Son los códigos elegidos para distinguir presión de ese consumidor y capacidad compartida.

En ambos casos incluye Retry-After con un segundo orientativo. No sabemos cuándo terminará la operación activa, así que ese valor no reserva una plaza ni garantiza que un reintento vaya a entrar.

Una cola acotada puede tener sentido para otro requisito. Habría que definir su tamaño, espera máxima, cancelación, caducidad y qué ocurre al reiniciar. Cambiar un rechazo inmediato por una cola infinita no resuelve la sobrecarga: hace que las respuestas lleguen cada vez más tarde.

Tampoco debe el cliente reintentar en un bucle inmediato. La recuperación necesita espera y una política de reintentos; para operaciones con efectos, también las garantías de idempotencia correspondientes. Este laboratorio solo devuelve texto importado, no ejecuta un cobro o una escritura remota.

## La cancelación debe detener el trabajo, no solo la respuesta

Un deadline que deja de esperar una promesa no implica que la tarea subyacente se haya detenido. Si liberamos el cupo mientras esa tarea continúa, el contador ya no representa el trabajo real.

El importador del laboratorio utiliza una señal de aborto en el cliente HTTP. Cuando el proveedor ficticio no responde, se cierra el intento, la API devuelve 504 y después finally libera la reserva. Una siguiente importación puede ejecutarse. Ese caso usa HTTP de salida real, no solo una promesa rechazada artificialmente.

Las pruebas de concurrencia usan además una promesa retenida que el test libera explícitamente. Sirve para comprobar decisiones de admisión sin depender de una pausa elegida a ojo. No mide CPU, memoria o throughput.

No implementamos cancelación al desconectarse el lector de la respuesta HTTP. El cupo sigue ocupado hasta que termina el importador o vence su deadline. Ese límite evita confundir «el usuario ya no espera» con «el backend ya dejó de trabajar».

## Prueba quién empezó a trabajar, no solo quién recibió error

Descarga el [laboratorio de amenazas](/assets/examples/api-amenazas-lab.zip). Con Node 24.19.0 o posterior y pnpm 12.8.1:

```bash
pnpm test
pnpm serve:limits
```

El segundo comando inicia la API y los dos destinos ficticios locales. Solo admite el modo safe de importación y usa la política descrita. No requiere librerías de aplicación ni credenciales reales.

Un test mantiene una importación North activa y envía ocho solicitudes más en paralelo. Todas se rechazan, el trabajo solo ha empezado una vez y no se ejecuta una cola oculta cuando liberamos la primera. Otro configura capacidad global uno y comprueba que South recibe 503 sin iniciar trabajo.

Estas observaciones son más precisas que afirmar que el servicio «aguanta carga». No hemos realizado un load test ni encontrado el límite de una máquina.

## Garantías y límites

La admisión ocurre después de autenticar el fixture, verificar el tenant y leer un body acotado, antes del importador. No limita conexiones TCP o ataques volumétricos que llegan antes de esa frontera. Necesita controles de recepción y red adecuados al despliegue.

Los contadores están en memoria y solo conocen North y South. No hay réplicas, persistencia, cola duradera, reservas por cliente, fairness garantizada o presupuesto económico diario. Los límites se eligen para hacer visibles los casos, no para copiarse como configuración de producción.

T06 queda comprobado dentro de ese alcance de laboratorio. P030 sigue parcial: autenticación y secretos reales todavía necesitan sus entregas, y la renovación de sesión OIDC anterior mantiene su límite declarado.

## Ejercicio: que un fallo no deje capacidad ocupada

Añade un importador que rechace su promesa después de haber empezado. Comprueba que otra solicitud del mismo tenant se rechaza mientras está pendiente y puede entrar cuando termina, siempre que le queden tokens.

Después contrasta el resultado con un importador que ignora la cancelación y nunca finaliza. Decide si necesitas aislamiento del worker o de su proceso. No liberes la reserva fingiendo que un trabajo que continúa ya no consume recursos.

En la [siguiente entrega de token bucket](/posts/rate-limiting-token-bucket-tenant) seguiremos el otro presupuesto: cuántos intentos puede admitir el consumidor a lo largo del tiempo.

## Referencias

- [OWASP API4:2023: Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- [OWASP: Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html).
- [RFC 9110: Service Unavailable y Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html).

Fuentes consultadas el 19 de octubre de 2026. La evidencia descrita corresponde al fixture local, no a una prueba de resistencia de infraestructura.
