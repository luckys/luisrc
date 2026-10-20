---
id: DIST-RETRIES
title: 'Retries con presupuesto: deadlines, jitter y backpressure'
published: 2026-10-17T03:02:00Z
locale: es
translationKey: reliable-retry-budgets
slug: retries-deadlines-backoff-backpressure
draft: true
status: draft
level: intermedio
prerequisites: [DIST-IDEMPOTENCY]
description: 'Decide qué reintentar, durante cuánto tiempo y con cuánta concurrencia. Evita convertir un fallo transitorio en una cascada de carga.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [resiliencia, retries, backpressure, nodejs]
---

El proveedor empieza a responder despacio. Cada capa reintenta tres veces y el tráfico que recibe crece justo cuando menos capacidad tiene. El mecanismo pensado para recuperar peticiones termina prolongando la caída.

Un **retry** necesita permiso semántico, límite temporal y límite de carga. Partimos de [idempotencia](/posts/idempotencia-api-claves-efectos): si repetir puede crear otro efecto, añadir esperas aleatorias no lo vuelve seguro.

## Clasificar antes de repetir

Un rechazo definitivo de negocio no suele arreglarse con el mismo intento. Un error transitorio puede justificar otro, pero un timeout también puede ocultar un efecto ya ejecutado. Antes de reintentar, decide cómo se conserva la identidad y cómo se consulta un resultado incierto.

Además, elige una capa responsable de los retries. Si tres capas hacen hasta tres intentos cada una, una solicitud puede desencadenar hasta 27 llamadas al nivel inferior, según el recorrido. No es una medición, sino el producto de esos límites hipotéticos.

## Deadline total y timeout por intento

Un **timeout** limita una espera concreta. Una **deadline** fija hasta cuándo tiene sentido continuar con la operación completa. El tiempo de espera entre intentos también consume ese presupuesto.

El helper del laboratorio recibe un reloj y una función de espera para probarlo sin dormir. Antes de cada intento calcula el tiempo restante y lo entrega a la operación. Esta debe utilizarlo para limitar su I/O, por ejemplo mediante cancelación soportada por el cliente HTTP.

<img src="/assets/visuals/reliable-services/DIST-RETRIES.svg" alt="Una deadline total incluye intento, espera con jitter y nuevo intento; un bulkhead limita llamadas activas y rechaza exceso antes de saturar el proveedor." width="733" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-RETRIES.svg).

## Exponential backoff con full jitter

Con **full jitter**, la espera se elige aproximadamente entre cero y el menor de un límite y una base multiplicada por una potencia de dos. La intención es separar clientes que fallaron al mismo tiempo, no garantizar que el siguiente intento funcionará.

Archivo: `reliable-services/src/distributed.ts` (extracto).

```typescript
export function fullJitter(
  attempt: number,
  base: number,
  cap: number,
  random: () => number,
): number {
  return Math.floor(random() * Math.min(cap, base * 2 ** attempt))
}
```

`attempt` empieza en cero para la primera espera. El test inyecta `random = 0.5`, lo que hace el cálculo reproducible. En ejecución normal usaríamos una fuente aleatoria adecuada, no el valor fijo del test.

El escenario verificado utiliza una deadline de 250 ms en un **reloj simulado**. El primer intento consume 100, espera 50 y el segundo consume otros 100. No queda presupuesto para continuar. Son tiempos calculados por el test, no latencias medidas del proveedor.

## No aceptes trabajo ilimitado mientras esperas

Un **bulkhead** limita el número de llamadas activas a una dependencia. El del laboratorio admite un cupo fijo y rechaza el exceso; libera el cupo en `finally`, también si la llamada falla. Rechazar pronto puede ser preferible a acumular promesas sin límite.

**Backpressure** comunica o impone que no podemos aceptar más trabajo a ese ritmo. **Load shedding** descarta trabajo para proteger lo que queda. Si decides encolar, la cola también necesita capacidad y una política de vencimiento: trasladar una acumulación de RAM a una DB no la hace infinita.

Un **circuit breaker** deja de intentar durante un periodo tras un patrón de fallos y permite sondas controladas. No sustituye timeout ni idempotencia. Un **rate limit** limita una tasa; el bulkhead limita simultaneidad. Puedes necesitar ambos porque protegen magnitudes diferentes.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-retries/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

El helper `retry` no mata una promesa ni detiene por la fuerza trabajo remoto. Sin una operación que respete el tiempo restante, puede superar la deadline. El reloj de producción para duraciones debe evitar saltos del reloj civil; el del test es controlado.

Solo se implementan retry budget y bulkhead local. Circuit breaker y límites distribuidos se explican como alternativas, no se presentan como código ya construido.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/distributed.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="jitter|bulkhead" tests/core.test.mjs
```

## Ejercicio: una política por resultado

Para éxito, rechazo, `429`, timeout y conexión rota, escribe si consultas estado, reintentas o detienes. Define intentos máximos, deadline y concurrencia. Incluye la política cuando el servidor indica una espera que supera tu presupuesto.

Después llevaremos ese trabajo pendiente a [colas, leases y ACK](/posts/colas-ack-leases-trabajos-duplicados).

## Referencias

- [AWS: timeouts, retries y jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
- [Google SRE: manejo de sobrecarga](https://sre.google/sre-book/handling-overload/).
- [Node.js 24: AbortSignal](https://nodejs.org/docs/latest-v24.x/api/globals.html#class-abortsignal).

Fuentes consultadas el 17 de octubre de 2026.
