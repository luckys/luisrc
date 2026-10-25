---
id: "CAP-UTILIZATION"
title: "Utilización y réplicas: dimensionar con margen sin inventar un porcentaje universal"
published: "2026-10-25T17:01:00Z"
locale: "es"
translationKey: "capacity-costs-cap-utilization"
slug: "utilizacion-cpu-replicas-margen-capacidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P066"]
description: "Cómo convertir demanda CPU en un mínimo de réplicas y comprobar la pérdida de una. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

Una réplica parece infrautilizada al 40% de CPU. Se elimina la mitad del despliegue para ahorrar y la siguiente ráfaga deja la API sin margen. Mirar un porcentaje aislado no explica cuánto trabajo admite el servicio ni qué ocurrirá al perder una instancia.

Después de [RPS y concurrencia](/posts/rps-concurrencia-ley-little-capacidad), vamos a separar demanda CPU, capacidad disponible y margen elegido. El objetivo es poder recalcular réplicas, comprobar el efecto de una pérdida y detectar cuándo el resultado excede un límite.

## Utilization necesita una referencia concreta

La **utilization** de CPU compara consumo y capacidad de referencia durante un intervalo. Un proceso que usa medio core puede aparecer al 50% de un core, al 25% de dos, o con otra cifra si la métrica se expresa respecto a una request de Kubernetes.

En el laboratorio definimos una réplica con **un core** y una demanda hipotética de **10 ms de CPU por petición**. El trabajo es perfectamente divisible entre réplicas a efectos del cálculo. No hemos medido ese coste en una API ni afirmamos escalado lineal real.

A 300 RPS, la demanda CPU idealizada es:

`300 peticiones/s × 0,010 s CPU/petición = 3 cores`

Tres réplicas consumirían el 100% de su capacidad ideal. Esa cuenta no deja margen para variación, tareas auxiliares o una réplica que desaparezca.

## Elegir un target es formular una hipótesis sobre el margen

Fijamos **target = 0,6** como política del ejemplo. Con ese target, una réplica aporta 60 RPS presupuestados, aunque el techo CPU idealizado sea 100 RPS.

`réplicas de trabajo = ceil(demanda CPU / (cores por réplica × target))`

Para 300 RPS obtenemos cinco. Después añadimos una réplica de margen: **seis en total**. Con todas disponibles, la utilización media idealizada es 3/6, el 50%. Si perdemos una, sería 3/5, el 60%.

Ese 60% no es una frontera universal entre «bien» y «mal». Dos servicios con igual media CPU pueden tener colas, pausas o percentiles muy distintos. Elegirlo exige pruebas con el patrón de tráfico y el objetivo de latencia que realmente importa.

<img src="/assets/visuals/capacity-costs/CAP-UTILIZATION.svg" alt="Cómo convertir demanda CPU en un mínimo de réplicas y comprobar la pérdida de una. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="291" height="602" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-UTILIZATION.svg).

## El cálculo debe mostrar cuándo no cabe

En `packages/capacity-costs/src/model.ts`, `Shape` agrupa CPU por petición, cores por réplica, target, mínimo, máximo y réplicas de margen:

```typescript
export function replicasFor(rps: number, s: Shape) {
  validShape(s);
  bounded(rps, 0, 10000);
  const required = Math.max(
    s.min,
    Math.ceil((rps * s.cpuMs) / (1000 * s.cpuCores * s.target)) + s.spare,
  );
  const provisioned = Math.min(s.max, required);
  const demandCores = (rps * s.cpuMs) / 1000;
  return {
    required,
    provisioned,
    feasible: required <= s.max,
    cpuUtilization: demandCores / (provisioned * s.cpuCores),
    afterLossUtilization: demandCores / ((provisioned - s.spare) * s.cpuCores),
  };
}
```

La función conserva **required**, la cantidad calculada antes del máximo, y **provisioned**, la cantidad que permitiría el límite. `feasible` impide interpretar el recorte como capacidad suficiente.

A 600 RPS con los mismos supuestos se necesitan once réplicas para conservar target y margen. El máximo de ocho hace que `feasible` sea falso. Seguir devolviendo ocho y ocultar ese resultado sería un error de diseño del estimador.

`afterLossUtilization` comprueba el escenario de retirar las réplicas indicadas en `spare`. La validación exige que el mínimo deje al menos una réplica después de esa pérdida; así evitamos una división por cero disfrazada de resultado útil.

## Una réplica extra no demuestra high availability

El margen **N+1** del ejemplo cubre una pérdida individual en la aritmética CPU. Dos réplicas en el mismo nodo pueden caer juntas. Una dependencia común puede bloquearlas a todas. Distribuirlas entre zonas también cambia red, latencia y costes.

Necesitamos declarar el fallo que pretendemos tolerar y comprobar el recorrido completo. Un número de réplicas, por sí solo, no acredita failover, conservación de conexiones ni ausencia de errores durante una actualización.

La [documentación de recursos de Kubernetes](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) distingue requests usadas para scheduling de limits de ejecución. El target de este artículo se refiere a un core hipotético por réplica; no reutiliza sin explicación el porcentaje respecto a requests del HPA anterior.

## Baja utilización puede ser un coste deliberado

Con 8 RPS y dos réplicas, la utilización calculada es del 4%. El mínimo tiene más peso que la demanda. Reducirlo a una ahorraría compute, pero cambiaría el fallo que podemos tolerar y la capacidad de absorción inmediata.

Hay alternativas razonables: aceptar una interrupción breve en un entorno de desarrollo, programar capacidad antes de un pico conocido o elegir una ejecución elástica con otras restricciones de arranque y límites. La decisión depende del servicio, no de un objetivo de «CPU siempre alta».

También falta memoria. Un servicio puede agotar RAM con CPU baja si mantiene muchas peticiones esperando. Este modelo no deriva memoria de CPU; esa dimensión necesita sus propias medidas.

## Tests y contraste de supuestos

Las pruebas comprueban seis réplicas a 300 RPS, el mínimo con carga cero y la inviabilidad a 600 RPS. Rechazan un target cero. En los tres presupuestos posteriores duplicamos además CPU por petición: una variación pequeña en la entrada puede cruzar un escalón de réplica o superar el máximo.

Para un proyecto real mediríamos CPU por petición por clase de operación, throughput, errores, memoria y percentiles bajo carga. Después repetiríamos el ensayo con una réplica ausente. Un benchmark del portátil no justifica trasladar el mismo target a producción.

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

El cálculo conserva unidades y explicita margen y restricciones CPU. No modela contención entre hilos, GC, cachés, distribución desigual o pérdida de zona. Tener un resultado factible en esta cuenta es una condición parcial, no aceptación del SLO.

## Ejercicio: revisar el fallo que cubre el margen

Calcula la utilización antes y después de perder una réplica con 120 RPS. Después imagina que un nodo aloja dos réplicas: explica qué prueba faltaría y qué cambiarías en el modelo para analizar esa pérdida. En la siguiente entrega añadimos una dependencia compartida al cálculo.

Continúa con [Cuellos de botella: por qué seis réplicas no siempre procesan más trabajo](/posts/cuellos-botella-capacidad-dependencias).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Resource Management, Kubernetes](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/).
- [Handling Overload, Google SRE](https://sre.google/sre-book/handling-overload/).
