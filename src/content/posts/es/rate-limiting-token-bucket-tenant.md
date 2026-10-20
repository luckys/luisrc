---
id: API-THREATS-RATE
title: 'Token bucket: limitar solicitudes por tenant sin confundir ráfagas y concurrencia'
published: 2026-10-18T04:29:00Z
locale: es
translationKey: rate-limiting-token-bucket-tenant
slug: rate-limiting-token-bucket-tenant
draft: true
status: draft
level: intermedio
prerequisites: [API-THREATS-CAPACITY]
description: 'Implementa un token bucket por tenant con burst, recarga y Retry-After. Contrasta reloj, identidad, rechazos y límites distribuidos con tests y una gráfica interactiva.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, rate-limiting, multi-tenant, testing]
---

North termina sus importaciones rápidamente y nunca ocupa más de una a la vez. Aun así, puede hacer tantas solicitudes seguidas que consume una parte desproporcionada del servicio. El límite de trabajo activo se cumple; el ritmo de admisión sigue sin estar acotado.

El **rate limiting** atiende esa segunda dimensión. Decide qué solicitudes admitimos según una política temporal. No sustituye el [límite de concurrencia](/posts/consumo-recursos-concurrencia-bulkheads): una cuota disponible no significa que haya capacidad libre para ejecutar.

Vamos a implementar una política pequeña por tenant con **token bucket** y a observar sus decisiones con un reloj controlado. Los parámetros son del ejercicio; elegirlos para un producto exige conocer sus operaciones y recursos.

## Capacidad y recarga responden a preguntas diferentes

Imagina un contador de permisos de admisión, los tokens. El bucket tiene una capacidad máxima B y recupera r tokens por segundo. Cada intento admitido cuesta c tokens.

Si no hay saldo suficiente, rechazamos sin gastar un token adicional. Si lo hay, descontamos el coste. El saldo nunca supera B, por mucho tiempo que el consumidor permanezca inactivo.

En la demo, B vale cuatro, r vale uno y cada solicitud HTTP cuesta un token. El bucket empieza lleno, así que permite una ráfaga de cuatro solicitudes al mismo instante lógico. La quinta necesita esperar a que haya saldo.

Esa ráfaga es una decisión de producto, no un fallo del limitador. Exigir un intervalo mínimo entre todas las solicitudes sería otra política. Rate limiting no significa necesariamente separar uniformemente cada petición.

## Actualiza el saldo cuando necesitas decidir

No hace falta un temporizador que incremente un contador cada segundo. Al recibir un intento calculamos cuánto tiempo pasó desde la última actualización:

```text
saldo actualizado = min(B, saldo anterior + r × segundos transcurridos)
```

Con saldo cero y r igual a uno, tras medio segundo hay 0,5 tokens. Todavía no alcanza para un intento de coste uno. Tras otro medio segundo sí alcanza.

Este es el método take completo de `admission.mjs`. capacity, refillPerSecond, tokens, last y now pertenecen al bucket creado antes; positiveInteger comprueba un entero positivo representable de forma segura:

```javascript
    take(cost = 1) {
      if (!positiveInteger(cost) || cost > capacity)
        throw new RangeError('Invalid token cost')
      const tick = now()
      if (!Number.isFinite(tick)) throw new RangeError('Invalid clock')
      tokens = Math.min(
        capacity,
        tokens + (Math.max(0, tick - last) * refillPerSecond) / 1000,
      )
      last = Math.max(last, tick)
      if (tokens < cost)
        return {
          allowed: false,
          remaining: tokens,
          retryAfter: Math.ceil((cost - tokens) / refillPerSecond),
        }
      tokens -= cost
      return { allowed: true, remaining: tokens, retryAfter: 0 }
    },
```

now devuelve milisegundos, por eso dividimos entre 1000 antes de aplicar la tasa por segundo. No mezclar unidades es parte del algoritmo, no un detalle cosmético.

La comprobación, actualización y descuento son síncronos en un proceso. No hay una espera entre leer el saldo y gastarlo. Esto evita que dos callbacks de ese mismo event loop admitan usando un saldo anterior que ya no existe.

<img src="/assets/visuals/api-contracts/API-THREATS-RATE.svg" alt="Cada tenant tiene su propio bucket. Al llegar una solicitud se calcula la recarga con tiempo transcurrido, se limita a la capacidad y se compara el coste. Si hay saldo se descuenta y se admite; si no, se devuelve 429 con Retry-After orientativo sin descontar más." width="311" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-RATE.svg).

## El reloj forma parte de la política

Por defecto usamos performance.now para medir tiempo transcurrido dentro del proceso. No necesitamos una fecha del calendario para recargar tokens. La documentación de Node describe ese reloj relativo al inicio del proceso.

Los tests inyectan now. Pueden avanzar de cero a 500 y a 1000 ms sin dormir y sin depender del scheduler para comprobar un borde. Es tiempo lógico de prueba, no una medición de latencia de la API.

También probamos un reloj que retrocede. Math.max evita una recarga negativa y conserva la última referencia temporal máxima. Si actualizáramos last al valor retrasado, al avanzar otra vez podríamos contar dos veces parte del mismo intervalo.

Un proceso nuevo empieza con buckets llenos. Si necesitamos continuidad tras reinicios, este almacenamiento no basta. Tampoco podemos comparar sin más lecturas de performance.now tomadas en máquinas distintas: no comparten el mismo origen temporal.

## La clave de cuota debe proceder de identidad verificada

La API reconoce primero la identidad de fixture y verifica el tenant de la ruta. El controlador utiliza ese tenant como clave. No lee un tenantId del body ni acepta que X-Tenant cambie el presupuesto activo.

Los tests varían X-Forwarded-For y X-Tenant mientras siguen actuando como Alice en North. Al agotarse North reciben 429; no consiguen saltar a South. Una petición legítima de Bob a South todavía tiene su saldo.

Limitar por IP puede ser útil en otra frontera, pero una IP no equivale a un usuario o tenant. Además, una cabecera de forwarding solo debe interpretarse dentro de una cadena de proxies de confianza bien definida. Este servidor no la usa para decidir la identidad ni la cuota.

Cada clave también consume memoria. La demo solo crea dos buckets conocidos. Crear uno por cualquier string recibido permitiría agotar el almacenamiento del propio limitador; una implementación con altas dinámicas necesitaría límites y caducidad.

## Retry-After orienta, pero no reserva tokens

El déficit dividido entre la recarga indica cuándo podría haber saldo suficiente si nadie más lo utiliza. Lo redondeamos hacia arriba para emitir Retry-After en segundos enteros.

Con un déficit de medio token y recarga uno por segundo, la espera calculada es medio segundo y la cabecera vale uno. El status es **429 Too Many Requests**, definido en RFC 6585. La cabecera es una indicación para el cliente, no la promesa de que su siguiente intento será admitido.

Otro miembro del mismo tenant puede gastar el saldo recién recuperado. Además, puede seguir ocupado el cupo de concurrencia. El cliente necesita gestionar otro rechazo en lugar de asumir que el tiempo indicado le concede una reserva.

El servicio no implementa colas ni temporizadores por cliente. Reintentar inmediatamente y en paralelo empeoraría la presión que la política intenta reducir.

## Decide qué rechazos consumen cuota

El controlador reserva primero capacidad activa y después consulta el bucket. Si el cupo ya está lleno, rechaza sin gastar tokens. Si la cuota temporal deniega, finally libera la reserva recién obtenida y no empieza el trabajo.

Una vez admitido, el token no se reembolsa por un 502, un 504 o un error de contrato detectado dentro del importador. El intento ya ha cruzado la frontera de admisión. Esta elección limita también los reintentos que provocan fallos repetidos.

El parsing básico del body y la identidad ocurren antes. JSON roto, ausencia de identidad o tenant ajeno no gastan tokens de este controlador, aunque sí consumen recursos de recepción que necesitan otros controles. Los tests comprueban la ausencia de trabajo y que siguen disponibles los cuatro intentos válidos iniciales.

La función pura admite costes enteros distintos, y se prueba take(2). Sin embargo, la integración HTTP usa siempre coste uno, elegido por el servidor. No mide CPU o dinero ni confía en un campo cost enviado por el cliente.

## Observa la ráfaga con una gráfica y sus decisiones en texto

Abre el [explorador de token bucket](/assets/interactive/api-quota/quota-explorer.html). Con capacidad cuatro y recarga uno, avanza por la ráfaga: cuatro decisiones admitidas, un rechazo inmediato, otro a 500 ms y una admisión a 1000 ms.

Después aparece South, con su bucket independiente. Puedes cambiar capacidad y recarga o comparar el escenario sostenido y el de tenants alternos. La lista muestra timestamp lógico, tenant, decisión, saldo y espera; no dependemos solo del color de los puntos.

El eje horizontal de la gráfica cuenta intentos de North, no segundos. El vertical muestra su saldo observado después de decidir. El visor usa el mismo algoritmo que la API, pero no llama a la API ni simula el cupo de trabajos activos.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-rate/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

Consulta el [laboratorio de amenazas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/admission.mjs) y ejecuta `pnpm test` con Node 24.19.0 o posterior. `pnpm serve:limits` inicia la integración HTTP con cuota y concurrencia, sobre datos ficticios de loopback. No requiere librerías de aplicación.

Se prueban ráfaga, recarga parcial, techo, costes inválidos, reloj retrasado, aislamiento de tenant, cabeceras no confiables y liberación tras rechazo. Las pruebas HTTP usan un reloj inyectado para las decisiones temporales; el caso de deadline del importador sí ejecuta una petición HTTP de salida real.

No hay limitador distribuido ni persistencia. Con dos procesos independientes, cada uno mantendría su propia cuota. Compartir estado exigiría hacer atómica la decisión completa de leer, recargar y descontar, y probar fallos y concurrencia de ese almacenamiento. No presentamos un Map como sustituto de esa coordinación.

Tampoco hay cuotas económicas diarias, mitigación volumétrica, clasificación de bots o garantía contra todos los abusos. Cumplir una tasa puede seguir permitiendo una operación de negocio no deseada. El threat model debe conservar esas diferencias.

## Ejercicio: admitir el coste que realmente has decidido

Define dos operaciones con costes distintos controlados por el servidor. Escribe un test donde un cliente intenta reducir el coste enviándolo en el body y no consigue más admisiones.

Después decide qué debería ocurrir si el almacenamiento compartido del limitador no responde: rechazar, admitir temporalmente o reducir capacidad local. Escribe el riesgo aceptado y la evidencia que necesitas. No existe una respuesta universal que podamos deducir solo del nombre del algoritmo.

## Referencias

- [RFC 6585: 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585.html#section-4).
- [RFC 9110: Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after).
- [Node.js: performance.now](https://nodejs.org/api/perf_hooks.html#performancenow).
- [OWASP API4:2023: consumo de recursos](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).

Fuentes consultadas el 19 de octubre de 2026. La gráfica es un modelo de decisiones, no un benchmark del servicio.
