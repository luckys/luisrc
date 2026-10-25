---
id: CD-ROLLING
title: 'Rolling deployments: convivir con dos versiones sin perder compatibilidad'
published: 2026-10-25T13:04:00Z
locale: es
translationKey: progressive-delivery-rolling
slug: rolling-deployments-versiones-compatibilidad
draft: true
status: draft
level: intermedio
prerequisites: [CD-SMOKE]
description: 'Sustituye dos instancias por pasos y verifica la convivencia de versiones con HTTP y PostgreSQL reales. Explica readiness, capacidad temporal, drenaje y compatibilidad sin prometer downtime cero.'
author: 'Luis Ramírez Calle'
series: 'CI/CD: entregar cambios y conservar una vuelta atrás'
tags: [rolling-deployment, compatibilidad, docker, operaciones]
---

La primera instancia nueva funciona. La segunda sigue ejecutando la versión anterior, y ahora una misma petición puede encontrar cualquiera de las dos. Si solo probaste cada versión aislada con su propio esquema, todavía falta comprobar esta convivencia.

Un **rolling deployment** sustituye instancias por pasos. Reduce la necesidad de reemplazar todo el grupo de golpe, pero crea un periodo en el que conviven versiones y puede variar la capacidad disponible.

Usaremos el [smoke del contrato del precio](/posts/smoke-tests-release-correcta-http-200) para decidir cuándo reincorporar cada slot al tráfico de prueba.

## La unidad de sustitución es una instancia

El grupo inicial tiene dos slots, `a` y `b`, con la image estable. El router alterna entre ambos para las peticiones que no pertenecen al canary. Cada slot corresponde a un servicio Compose independiente, lo que permite reemplazar uno y observar el otro.

El harness retira primero `a` de la ruta, recrea su container con el image ID candidato y espera a su readiness. Después reincorpora `a` y envía peticiones que deben mostrar las dos revisiones.

El segundo paso retira `b`, lo reemplaza y vuelve a comprobar el grupo. No hay un controlador de Kubernetes haciendo ese trabajo: es una secuencia explícita para estudiar el mecanismo.

<img src="/assets/visuals/progressive-delivery/CD-ROLLING.svg" alt="El grupo empieza con a y b en v1. El harness dirige tráfico de prueba a b mientras reemplaza a, comprueba convivencia de v2 y v1, retira y reemplaza b y termina con ambos en v2 y la flag apagada." width="278" height="692" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/progressive-delivery/CD-ROLLING.svg).

## Capacidad adicional y capacidad no disponible son presupuestos distintos

Si deseas dos instancias, puedes crear una tercera antes de retirar una antigua. Necesitas capacidad temporal adicional. Otra opción es retirar una primero y trabajar con una disponible durante la sustitución.

En controladores como el Deployment de Kubernetes, **maxSurge** limita cuántas instancias adicionales pueden crearse y **maxUnavailable** limita cuántas pueden faltar respecto al objetivo. Esos límites ordenan el rollout; no demuestran que las instancias restantes soporten la carga real.

El fixture usa el segundo recorrido para el grupo `a/b`: retira un slot antes de reemplazarlo y mantiene el otro como destino. El servicio `green` también existe para los otros ejercicios, pero no actúa como capacidad de emergencia automática del rolling.

Pasar de dos destinos a uno puede aumentar la carga del restante. Como este laboratorio solo envía probes secuenciales, no hemos medido saturación ni demostrado que esa reducción de capacidad sea aceptable en producción.

## Esperar readiness y verificar el contrato cumplen papeles distintos

Compose espera el healthcheck de la instancia nueva antes de que el harness vuelva a añadirla al router. Esto evita incluir una instancia que todavía no ha satisfecho ese chequeo.

El chequeo consulta PostgreSQL. Después, las peticiones funcionales comprueban el precio. No se sustituye una observación por otra: la [regresión del candidato](/posts/feature-flags-deploy-release-comportamiento) solo aparece con la flag activada.

En este rolling la flag permanece apagada. La captura acredita que ambas revisiones atienden correctamente ese estado, no que la función nueva ya esté validada para liberarse.

## El script retira, reemplaza y vuelve a observar

Extracto de `scripts/exercise.mjs`, dentro del proyecto que acaba de crear el harness:

```javascript
  await setRoute(state(['b']))
  env.SLOT_A_IMAGE = candidate
  await compose('up', '-d', '--wait', '--wait-timeout', '90', '--no-deps', '--force-recreate', 'a')
  const firstRoute = await setRoute(state(['a', 'b']))
  const mixed = await probe(); assert.equal(good(mixed), true)
  assert.deepEqual(new Set(mixed.map((r) => r.body.revision)), new Set(['v1', 'v2-regression-fixture']))
```

`setRoute` actualiza destinos mediante IPC y refresca los puertos publicados. Esto último es necesario porque Docker asigna puertos aleatorios y recrear un container puede cambiarlos.

Las aserciones no se conforman con recibir respuestas correctas: exigen ver ambas revisiones en el periodo mixto. Además, el script inspecciona los image IDs efectivos de `a` y `b`. Así detectaría una prueba que hubiera seguido consultando solo la instancia antigua.

## Retirar de la ruta no cancela peticiones en curso

Cambiar la lista del router afecta a nuevas decisiones de routing. Una petición que ya eligió `a` puede seguir ejecutándose allí. La aplicación debe gestionar señales de cierre y trabajo en curso según su contrato.

Node atiende `SIGTERM` y cierra el servidor y el pool SQL con un límite. El harness no mantiene tráfico continuo ni fuerza una operación lenta durante esa ventana, así que no afirma haber probado drenaje completo bajo carga.

En un servicio real revisarías el tiempo de terminación, las conexiones persistentes, los workers, los mensajes en proceso y el comportamiento de los clientes ante un corte. Un rollout progresivo no elimina esas preguntas.

## La compatibilidad incluye datos, mensajes y respuestas

Ambas versiones comparten PostgreSQL. Antes del reemplazo añadimos `display_name` nullable y conservamos `name`. La versión antigua puede seguir escribiendo solo `name`; la nueva lee `COALESCE(display_name, name)` y escribe ambas columnas.

Eso funciona para estos productos inmutables. Si se permitieran actualizaciones concurrentes, habría que definir qué campo es la fuente de verdad y cómo evitar divergencias. Un backfill inicial no mantendría por sí solo la sincronización posterior.

Fuera del SQL, el mismo razonamiento alcanza a mensajes de una cola o a respuestas cacheadas. Mientras conviven versiones, puede haber productores y consumidores de contratos diferentes. Añadir campos suele ser más fácil de compatibilizar que retirar los que aún necesita una instancia antigua.

## Un rollout detenido necesita un estado comprensible

Si el reemplazo no queda listo o el probe falla, el proceso debe detenerse y conservar qué slots usan cada artefacto. Repetir «deploy» sin saber ese estado puede mezclar versiones de otra manera.

El fixture captura la ruta, las respuestas y las identidades en `rolling_first_slot` y `rolling_all_slots`. Al fallar el ejercicio se conserva un checkpoint parcial y se eliminan sus recursos desechables; esa limpieza es propia del laboratorio, no una política de recuperación de un servicio de producción.

## Código completo y pruebas

Consulta el [README del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/progressive-delivery/README.md) y el [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/cd-rolling/README.md):

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @luisrc-examples/progressive-delivery run exercise
pnpm --filter @luisrc-examples/progressive-delivery run verify
```

## Garantías y límites

Se reemplazaron containers reales y se observaron v1/v2 simultáneas, después v2/v2, con precios correctos y flag apagada. La base de datos compartida mantuvo el contrato expandido.

No se ha desplegado Kubernetes ni probado autoscaling, varias zonas, conexiones largas o disponibilidad continua. Las peticiones posteriores a cada paso no demuestran que ninguna petición pudiera fallar durante la transición.

## Ejercicio: presupuestar la sustitución

Para un grupo de dos instancias, diseña una secuencia con capacidad adicional y otra retirando una antes. Indica cuántas pueden atender en cada paso y qué observación permitiría continuar. Añade qué contrato SQL o de mensajes debe seguir funcionando durante el estado mixto.

## Referencias

- [Kubernetes: RollingUpdate, maxSurge y maxUnavailable](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).
- [Docker Compose: healthchecks y startup order](https://docs.docker.com/compose/how-tos/startup-order/).
- [AWS: compatibilidad de esquema entre versiones desplegadas](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/best-practices-for-managing-data-synchronization-and-schema-changes.html).

Fuentes consultadas el 25 de octubre de 2026.
