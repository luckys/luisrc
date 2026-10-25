---
id: "CAP-BOTTLENECKS"
title: "Cuellos de botella: por qué seis réplicas no siempre procesan más trabajo"
published: "2026-10-25T17:02:00Z"
locale: "es"
translationKey: "capacity-costs-cap-bottlenecks"
slug: "cuellos-botella-capacidad-dependencias"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["CAP-UTILIZATION"]
description: "Cómo acotar el throughput de una cadena y contrastar el coste de cada visita. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

La API pasa de dos a seis réplicas y el throughput apenas cambia. Las conexiones a la base de datos se acumulan, mientras la CPU de la aplicación sigue baja. Aumentar la capa que espera no amplía necesariamente la capa que hace el trabajo limitado.

Usaremos el [dimensionamiento CPU anterior](/posts/utilizacion-cpu-replicas-margen-capacidad) para seguir una petición por dos recursos. Aprenderemos a calcular un techo por recurso, contar visitas y distinguir una mejora local de una mejora del sistema.

## Cada petición demanda trabajo en varios recursos

En nuestro modelo, la API necesita **10 ms CPU** por petición. Una réplica con un core tiene un techo idealizado de 100 RPS. Seis réplicas elevan ese techo a 600 RPS, antes de márgenes y efectos reales de ejecución.

Añadimos una DB ficticia con **cuatro slots globales de trabajo**. Cada visita ocupa uno durante 5 ms y cada petición hace una visita. El techo de este recurso sería:

`4 slots / (0,005 s por visita × 1 visita por petición) = 800 peticiones/s`

Los slots representan capacidad de trabajo en el modelo, no una recomendación de cuatro conexiones ni la capacidad real de PostgreSQL. El número de conexiones abiertas y el de operaciones que una DB puede ejecutar eficientemente no son equivalentes.

El throughput extremo a extremo no puede superar el menor de ambos techos: 600 RPS. Eso tampoco garantiza que trabajar a 599 RPS cumpla el objetivo de latencia.

<img src="/assets/visuals/capacity-costs/CAP-BOTTLENECKS.svg" alt="Cómo acotar el throughput de una cadena y contrastar el coste de cada visita. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="292" height="602" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-BOTTLENECKS.svg).

## Una consulta más lenta puede cambiar el recurso limitante

Si cada visita pasa de 5 a 20 ms, la DB ficticia baja de 800 a **200 RPS**. Las seis réplicas siguen ofreciendo un techo CPU de 600, pero el sistema queda limitado por la dependencia.

Este helper está en `packages/capacity-costs/src/model.ts`:

```typescript
export function bottleneck(
  replicas: number,
  s: Shape & { dbSlots: number; dbMs: number; visits: number },
) {
  validShape(s);
  bounded(replicas, 1, 100, true);
  bounded(s.dbSlots, 1, 1000, true);
  bounded(s.dbMs, 1, 10000);
  bounded(s.visits, 1, 100, true);
  const appRps = (replicas * s.cpuCores * 1000) / s.cpuMs;
  const databaseRps = (s.dbSlots * 1000) / (s.dbMs * s.visits);
  return {
    appRps,
    databaseRps,
    ceilingRps: Math.min(appRps, databaseRps),
    limiting:
      appRps < databaseRps ? "app" : appRps > databaseRps ? "database" : "both",
  };
}
```

`visits` importa tanto como `dbMs`. Si cada petición hace cuatro visitas de 5 ms, la demanda total por petición es 20 ms de slot. El techo vuelve a 200 RPS bajo estos supuestos. Agrupar consultas, evitar un N+1 o cambiar el access pattern puede ser más útil que añadir réplicas HTTP.

La función devuelve ambos techos y cuál limita. No calcula un percentil de latencia ni resuelve la cola de la DB. Mantener esos resultados separados evita presentar un límite algebraico como rendimiento medido.

## Espera y trabajo de servicio no son el mismo dato

Si una consulta tarda 200 ms desde que se solicita una conexión hasta que vuelve el resultado, puede haber gastado 180 ms esperando y 20 ms ocupando el recurso. Usar los 200 ms como tiempo de servicio y después añadir otra cola contaría parte de la espera dos veces.

Antes de modificar capacidad conviene separar espera de pool, ejecución, bloqueos, red y procesamiento posterior. Las [traces](/posts/propagacion-trazas-react-api-worker) y las métricas de cada recurso ayudan a formular la hipótesis, pero tampoco convierten una correlación en causa por sí solas.

En un sistema real algunos recursos no admiten un modelo de slots homogéneos. Un lock sobre una fila caliente puede serializar operaciones aunque haya CPU y conexiones libres. Una quota de proveedor puede fijar un límite por cuenta que no cambia al duplicar procesos.

## Añadir réplicas puede empeorar la presión sobre la DB

Si cada réplica mantiene un pool máximo de veinte conexiones, seis réplicas pueden intentar abrir hasta 120. Haber configurado un pool pequeño en cada proceso no acota automáticamente el total de la flota.

Aumentar los pools puede reducir una espera local y, a la vez, aumentar contención o memoria en la DB. Una estrategia de **admission control** limita cuánto trabajo se admite; una cola limitada controla cuánto puede esperar; un timeout permite abandonar cuando el resultado ya no resulta útil. Son decisiones distintas.

El capítulo [Handling Overload de Google SRE](https://sre.google/sre-book/handling-overload/) explica por qué el servicio necesita un comportamiento definido bajo sobrecarga. Escalar no elimina la necesidad de rechazar o degradar trabajo cuando se alcanza un límite.

## Dos experimentos que distinguen hipótesis

Si sospechas CPU de la API, conserva las consultas y aumenta solo capacidad CPU, observando throughput, latencia y consumo. Si sospechas una consulta, conserva la flota y reduce trabajo de DB en una variante controlada. En ambos casos necesitas comprobar que el generador sigue emitiendo la misma demanda.

La calculadora archiva dos entradas, con 5 y 20 ms por visita. El cambio de techo de DB es un resultado calculado. No hemos desplegado ni sometido una DB a carga en este laboratorio.

En un catálogo del portafolio, la aplicación práctica sería registrar qué operación concentra visitas y probar una mejora de su consulta o índice. Un cache también puede reducirlas, a cambio de política de expiración, memoria y coherencia. Un read replica añade otra posibilidad, pero no resuelve por sí sola escrituras o filas calientes.

## Código completo y pruebas

El código de laboratorio vive en el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git). Consulta el [modelo y validaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/src/model.ts), las [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/tests/model.test.mjs) y las [entradas de los escenarios](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/scenarios.json). No requiere credenciales ni servicios de pago.

Desde la raíz del monorepo, con Node.js 24.19.0 y pnpm 12.8.1:

```bash
pnpm --dir packages/capacity-costs test
pnpm --dir packages/capacity-costs exercise
pnpm --dir packages/capacity-costs verify
pnpm --dir packages/capacity-costs render
```

## Garantías y límites

El mínimo entre techos ayuda a descartar la idea de crecimiento ilimitado al añadir API. No incluye distribución de tamaños, correlaciones, locks ni recursos compartidos con otros servicios. Es una cota bajo supuestos, no una promesa de capacidad sostenible.

## Ejercicio: encontrar el límite que se mueve

Repite la cuenta con dos réplicas y con seis, primero con una visita de 5 ms y después con cuatro. Explica en qué caso añadir API cambia el techo y en cuál no. La siguiente entrega mantiene estos límites, pero introduce el tiempo que tarda en estar lista la nueva capacidad.

Continúa con [Autoscaling y colas: qué ocurre mientras llegan las nuevas réplicas](/posts/autoscaling-colas-arranque-picos).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Handling Overload, Google SRE](https://sre.google/sre-book/handling-overload/).
- [Little (1961)](https://pubsonline.informs.org/doi/abs/10.1287/opre.9.3.383).
