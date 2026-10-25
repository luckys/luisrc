---
id: "CAP-AUTOSCALING"
title: "Autoscaling y colas: qué ocurre mientras llegan las nuevas réplicas"
published: "2026-10-25T17:03:00Z"
locale: "es"
translationKey: "capacity-costs-cap-autoscaling"
slug: "autoscaling-colas-arranque-picos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["CAP-BOTTLENECKS", "K8S-HPA"]
description: "Cómo explorar preparación, cola limitada y capacidad global en una traza explícitamente simulada. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

Una campaña comienza a las diez. El controlador pide más réplicas, pero las peticiones ya están entrando y las nuevas instancias aún no están listas. El gráfico puede mostrar el objetivo correcto mientras el servicio sigue rechazando trabajo.

Después de [observar el HPA real](/posts/kubernetes-hpa-metricas-escalado), vamos a aislar esa demora en una **simulación didáctica**. No reproduce el algoritmo de Kubernetes: permite cambiar una hipótesis cada vez y seguir llegadas, capacidad, cola y rechazos.

## El tiempo hasta disponer de capacidad forma parte del diseño

Hay varios pasos entre detectar presión y servir tráfico: recoger una métrica, decidir, asignar recursos, arrancar el proceso y superar readiness. Los tiempos y límites de cada paso condicionan qué puede absorber un sistema.

El HPA tiene además tratamiento de métricas ausentes, tolerancias y estabilización, descrito en su [documentación](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/). Nuestro controlador simplificado conoce directamente los RPS al muestrear. No deduce demanda a partir de CPU y no es un emulador del HPA.

La traza dura **300 segundos**, con pasos de cinco: 20 RPS durante el primer minuto, 300 RPS entre los segundos 60 y 180, y 20 RPS después. No es la reproducción mensual de ninguno de los tres perfiles de costes.

## Una cola limitada permite ver el trabajo que no cabe

Empezamos con dos réplicas y techo CPU idealizado de 100 RPS por réplica. La dependencia admite 800 RPS. El controlador muestrea cada quince segundos y la nueva capacidad tarda treinta segundos en prepararse.

A los 60 s detecta el pico y pide seis réplicas según la política anterior, incluyendo una de margen. Hasta los 90 s siguen listas dos: el techo es 200 RPS frente a 300 de demanda. Se acumulan 100 peticiones por segundo durante ese tramo.

La cola admite **1000 peticiones**. Cuando se llena, el excedente se rechaza. Con estas entradas, la simulación calcula **2000 rechazos**; con seis réplicas preparadas desde el principio, calcula cero. Son resultados del modelo, no errores HTTP observados en un despliegue.

<img src="/assets/visuals/capacity-costs/CAP-AUTOSCALING.svg" alt="Cómo explorar preparación, cola limitada y capacidad global en una traza explícitamente simulada. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="261" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-AUTOSCALING.svg).

## Conservamos trabajo en cada paso

El núcleo de `simulate`, en `packages/capacity-costs/src/model.ts`, procesa cantidades fluidas por intervalo:

```typescript
    const capacityRps = Math.min(
      (ready * p.cpuCores * 1000) / p.cpuMs,
      p.dbRps,
    );
    const incoming = rps * 5;
    const completed = Math.min(queue + incoming, capacityRps * 5);
    const waiting = queue + incoming - completed;
    const dropped = Math.max(0, waiting - p.queueLimit);
    queue = Math.min(p.queueLimit, waiting);
    arrived += incoming;
    served += completed;
    rejected += dropped;
```

Se dispone del trabajo que ya esperaba más lo que entra durante el paso. La capacidad del intervalo limita cuánto se sirve; la cola limita cuánto puede conservarse. El resto se rechaza. La prueba exige en cada fila:

`llegadas acumuladas = servidas acumuladas + rechazadas acumuladas + cola actual`

Esto evita «resolver» la sobrecarga haciendo desaparecer peticiones. El modelo no sigue peticiones individuales, no tiene timeouts ni reintentos y aproxima llegadas y servicio como flujos dentro de cada paso. No podemos extraer de él un p99 de espera.

## Aumentar la cola cambia el síntoma y añade espera

Una cola mayor podría evitar rechazos en esta ráfaga finita, pero mantendría más peticiones esperando. Si la demanda se sostiene por encima de la capacidad, solo retrasa el momento de llenar la cola.

Además, el cliente puede haber agotado su timeout antes de que el servidor termine. Un reintento podría añadir nueva carga. La [gestión de overload](https://sre.google/sre-book/handling-overload/) requiere decidir límites y prioridades, no solo almacenar más trabajo pendiente.

Hay tres alternativas que conviene probar: preparar capacidad antes de un evento conocido, mantener más mínimo permanente o aceptar un volumen acotado de rechazos/degradación. Cada una cambia coste y experiencia. La mejor depende de la previsibilidad del pico y del objetivo del servicio.

## La dependencia sigue imponiendo su techo

La variante `slowDatabase` reduce el techo global a 200 RPS. Aunque haya seis réplicas listas, la cola no puede drenarse mientras entran 300 RPS. La traza calcula **11000 rechazos** y termina vaciando la cola cuando vuelve la carga baja.

Un autoscaler de API no crea capacidad en esa dependencia. Incluso con una señal de cola bien elegida, hace falta entender qué recurso podrá procesar el trabajo adicional.

El visor incluido en la entrega de presupuestos permite recorrer los sesenta intervalos con teclado, cambiar preparación y comparar las tres políticas. La tabla indica el estado al final del intervalo; RPS y réplicas son los aplicados durante él. El descenso espera sesenta segundos desde que se detecta un objetivo menor.

## Código completo y pruebas

El código de laboratorio vive en el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git). Consulta el [modelo y validaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/src/model.ts), las [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/tests/model.test.mjs) y las [entradas de los escenarios](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/scenarios.json). No requiere credenciales ni servicios de pago.

Desde la raíz del monorepo, con Node.js 24.19.0 y pnpm 12.8.1:

```bash
pnpm --dir packages/capacity-costs test
pnpm --dir packages/capacity-costs exercise
pnpm --dir packages/capacity-costs verify
pnpm --dir packages/capacity-costs render
```

## Tests, garantías y límites

Se verifican preparación a los 90 s, límites de réplicas, conservación de trabajo, cola máxima, rechazos y recuperación. El caso preparado desde el inicio tiene cero rechazos calculados, sin convertirlo en una garantía real de cero errores.

Faltan contención, distribución de tiempos de servicio, scheduling de nodos y el comportamiento concreto de un proxy. La simulación ayuda a plantear ensayos. El recorrido K3s anterior aporta evidencia del controlador real en su entorno; los dos artefactos responden preguntas distintas.

## Ejercicio: reducir una demora sin ocultar el coste

En el visor cambia preparación de treinta a cero segundos, conserva la misma traza y compara rechazos. Después repite con DB limitada a 200 RPS. Explica qué hipótesis arregla cada cambio y por qué el segundo problema persiste. Pasamos ahora de capacidad temporal a un presupuesto mensual con supuestos explícitos.

Continúa con [Estimar costes: tres perfiles de tráfico y un presupuesto que muestra sus supuestos](/posts/estimar-costes-servicio-tres-escenarios).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Horizontal Pod Autoscaling, Kubernetes](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).
- [Handling Overload, Google SRE](https://sre.google/sre-book/handling-overload/).
