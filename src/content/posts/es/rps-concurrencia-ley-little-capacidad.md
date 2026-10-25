---
id: "P066"
title: "RPS y concurrencia: cuántas peticiones hay dentro de tu servicio"
published: "2026-10-25T17:00:00Z"
locale: "es"
translationKey: "capacity-costs-p066"
slug: "rps-concurrencia-ley-little-capacidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["DESIGN-REQUIREMENTS", "P058", "P064"]
description: "Cómo relacionar tasa, tiempo medio y peticiones en curso sin confundir espera con CPU. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

Una API recibe 100 peticiones por segundo y tarda, de media, 200 ms en resolver cada una. ¿Cuántas peticiones está atendiendo a la vez? Responder «cien» mezcla una tasa con una cantidad. Esa confusión acaba convirtiéndose en pools demasiado pequeños o en máquinas compradas para cubrir un problema que era de espera.

Abrimos **Capacidad y costes** después de [definir requisitos y capacidad](/posts/requisitos-capacidad-invariantes-servicio), [medir latencia](/posts/latencia-percentiles-histogramas-errores) y [comparar diseños cloud](/posts/api-lambda-ecs-costes-supuestos). Vamos a calcular magnitudes compatibles, delimitar qué cuenta como trabajo en curso y reconocer cuándo una estimación deja de describir el sistema.

## RPS mide una tasa; concurrency cuenta trabajo en curso

**RPS**, requests per second, indica cuántas peticiones atraviesan un punto de medida por segundo. Conviene precisar si son intentadas, admitidas o completadas. Durante una sobrecarga pueden ser tres números diferentes.

**Concurrency** es la cantidad de operaciones que están dentro de un límite del sistema en un instante. Incluye las que esperan si hemos situado ese límite antes de la cola. No significa que todas ejecuten instrucciones CPU simultáneamente.

Piensa en un catálogo. Una petición entra, espera una conexión, consulta la base de datos y serializa una respuesta. Si contamos desde la entrada HTTP hasta el envío final, ese tiempo completo pertenece a su estancia. Si medimos solo la consulta, hemos definido otro subsistema y necesitamos su propia tasa de visitas.

## Little relaciona medias de la misma población

En un sistema estable con medias compatibles, **Little's Law** relaciona:

`L = λ × W`

**L** es la cantidad media de peticiones dentro del sistema. **λ** es la tasa media de paso, en peticiones por segundo. **W** es el tiempo medio de estancia, en segundos. La formulación original de [John D. C. Little](https://pubsonline.informs.org/doi/abs/10.1287/opre.9.3.383) establece condiciones sobre esas medias y el proceso; no afirma que cualquier par de números de un dashboard describa la misma población.

Con 100 RPS y 0,2 segundos, obtenemos **20 peticiones en curso de media**. Si el tiempo medio sube a 0,8 segundos y se mantiene el throughput estable en 100 RPS, la media pasa a 80.

La cuenta también puede verse como un área: cien llegadas por segundo permanecen dos décimas de segundo cada una. La suma de esas estancias ocupa veinte segundos de petición por cada segundo de reloj. Al dividir, queda una cantidad media de veinte peticiones.

<img src="/assets/visuals/capacity-costs/P066.svg" alt="Cómo relacionar tasa, tiempo medio y peticiones en curso sin confundir espera con CPU. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="240" height="602" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/P066.svg).

## La CPU no consume todo ese tiempo de estancia

Supón que los 200 ms incluyen 10 ms de CPU y 190 ms esperando I/O. Multiplicar 100 por 0,2 calcula concurrencia media, no veinte cores necesarios. La demanda CPU idealizada sería `100 × 0,010 = 1 core`, antes de márgenes y otras tareas.

Tampoco sería correcto configurar un pool de conexiones con veinte posiciones por esa cuenta. Si solo una parte de la estancia usa conexión, el límite del pool corresponde a esa parte. Aumentarlo puede desplazar la saturación a la DB en lugar de eliminarla.

En `packages/capacity-costs/src/model.ts`, el helper expresa unidades y rechaza entradas fuera del alcance didáctico:

```typescript
export function meanInFlight(rps: number, meanMs: number) {
  bounded(rps, 0, 10000);
  bounded(meanMs, 0, 3600000);
  return (rps * meanMs) / 1000;
}
```

`meanMs` es una media que aportamos como supuesto. El programa no la mide. `bounded`, definido en el mismo archivo, rechaza negativos, infinitos y valores fuera del rango documentado. Preferimos un error visible a calcular una concurrencia con `NaN`.

## Una prueba con clientes fijos cambia la carga al cambiar la latencia

Un generador **closed-loop** con veinte clientes que esperan respuesta antes de repetir reduce su tasa cuando el servicio se vuelve lento. Con 200 ms por operación y sin pausas adicionales, la aproximación es 100 RPS; con 800 ms, 25 RPS. El generador deja de ejercer la misma presión.

Un patrón **open-loop** intenta mantener un calendario de llegadas independiente de las respuestas. Si la aplicación no alcanza esa tasa, aparecerán esperas, rechazos o pérdidas en algún punto. También hay que comprobar que el generador tiene capacidad para emitir la carga prevista.

Por eso no basta con informar «veinte usuarios concurrentes». Hay que describir el comportamiento del cliente, los think times, el punto de medida y los errores. El laboratorio anterior de rendimiento trata los percentiles; aquí necesitamos primero que las unidades tengan sentido.

## El p99 no sustituye a la media de Little

Multiplicar RPS por p99 no produce un p99 de concurrencia. Los percentiles no se combinan como medias y faltaría conocer cómo coinciden en el tiempo las peticiones lentas.

Otra trampa es usar llegadas de un minuto de pico junto con la latencia media de todo el día. Y una cola que crece sin límite no está en el régimen estable que queríamos describir. En ventanas finitas importan las peticiones presentes al principio y las que siguen dentro al terminar.

La prueba del laboratorio comprueba 20 y 80 como resultados aritméticos bajo entradas declaradas. No los presenta como métricas observadas en un servicio. El comparador de la quinta entrega permite cambiar el tiempo medio conservando 100 RPS para explorar esa relación.

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

La fórmula ayuda a verificar la coherencia entre medidas y a formular hipótesis sobre capacidad. No garantiza una latencia máxima, un tamaño de pool adecuado ni un número suficiente de máquinas. Necesitamos distribución de trabajo, memoria, límites de dependencias y comportamiento ante fallos.

## Ejercicio: dibujar dos límites del mismo servicio

Define un límite HTTP completo y otro que incluya solo la DB. Para cada uno, escribe qué tasa y qué tiempo medio medirías. Después explica por qué el p99 HTTP no sirve como tiempo medio de ocupación de conexión. La siguiente entrega convierte la demanda CPU por petición en un cálculo de réplicas con margen.

Continúa con [Utilización y réplicas: dimensionar con margen sin inventar un porcentaje universal](/posts/utilizacion-cpu-replicas-margen-capacidad).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Little, A Proof for the Queuing Formula (1961)](https://pubsonline.informs.org/doi/abs/10.1287/opre.9.3.383).
- [Handling Overload, Google SRE](https://sre.google/sre-book/handling-overload/).
