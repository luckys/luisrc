---
id: "K8S-STARTUP"
title: "Startup probe: dar tiempo al arranque sin convertirlo en un bucle de reinicios"
published: "2026-10-25T16:04:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-startup"
slug: "kubernetes-startup-probe-inicializacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-INGRESS"]
description: "Cómo proteger una inicialización lenta antes de activar las otras probes. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

La API tarda ocho segundos en inicializarse, pero su comprobación de liveness permite mucho menos tiempo antes de reiniciarla. El proceso vuelve a empezar y nunca termina el arranque. Aumentar réplicas solo añade más procesos atrapados en el mismo ciclo.

Una **startup probe** permite distinguir «todavía estoy arrancando» de «he dejado de funcionar después». Tras [la entrada HTTP](/posts/kubernetes-ingress-controller-host-rutas), vamos a observar esa diferencia con dos Pods deliberadamente lentos.

## Startup protege una fase del ciclo de vida

Si hay startup probe, el kubelet espera a que tenga éxito antes de ejecutar las probes de liveness y readiness de ese container. Si el arranque falla más allá de su presupuesto, actúa según la política de reinicio.

No es una pausa ciega seguida de una suposición de éxito. La probe consulta una condición de inicialización y debe obtener el resultado esperado. Una aplicación que nunca consigue arrancar puede seguir fallándola.

En el ejemplo, `/startup` devuelve `503` hasta que termina un retardo de inicialización de ocho segundos. Es una fixture controlada para reproducir el caso; no estamos midiendo el tiempo real que tardaría una API de producción en preparar sus dependencias.

## El presupuesto debe permitir el arranque que queremos tolerar

El bloque `startupProbe` del Pod de prueba es:

```json
{
  "httpGet": {
    "path": "/startup",
    "port": "http"
  },
  "periodSeconds": 1,
  "failureThreshold": 30
}
```

Con periodo de un segundo y umbral de treinta fallos ofrecemos un margen aproximado de treinta segundos, además de los detalles de planificación y duración de las comprobaciones. No lo interpretamos como un cronómetro exacto de treinta segundos.

Las probes HTTP consideran exitosos los códigos de respuesta entre 200 y 399. Nuestra fixture utiliza `200` para inicialización completa y `503` para el estado pendiente; no devuelve siempre `200` solo para satisfacer al orquestador.

El puerto nombrado `http` corresponde al `containerPort` declarado. Sigue siendo necesario que el servidor escuche realmente en ese puerto.

<img src="/assets/visuals/kubernetes/K8S-STARTUP.svg" alt="La fixture tarda ocho segundos en inicializarse. Startup protege esa fase antes de habilitar las otras probes; el Pod equivalente sin startup muestra reinicios antes de completar su arranque." width="326" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-STARTUP.svg).

## El primer Pod arranca sin reinicios

El harness crea `slow-start`, espera que su container esté ejecutándose y consulta `/startup` antes de terminar la inicialización. Guarda el `503` y después espera a que el Pod esté Ready.

La captura exige **cero reinicios** al completar ese arranque. Liveness no ha interrumpido el retardo, aunque su presupuesto para fallos sea menor. El Pod de prueba tiene labels distintas del catálogo y no recibe tráfico de su Service.

Podemos comparar dos evidencias: el proceso ya existía cuando `/startup` aún respondía `503`, y más tarde pudo atender su estado preparado sin empezar otra vez. Ver solo `Running` habría perdido esa diferencia.

## El segundo Pod muestra qué ocurre sin esa protección

`no-startup` conserva el retardo y la liveness agresiva, pero elimina startup probe. El harness observa un aumento de `restartCount` y lo registra antes de retirar el Pod negativo.

Este caso no recomienda una configuración corta para producción. Sirve para demostrar un fallo concreto manteniendo las demás piezas del ejemplo. No damos por probado el problema simplemente porque el manifiesto parezca mal configurado.

Ambos Pods son experimentos aislados y se eliminan al terminar esta parte. No dejamos un bucle de reinicios consumiendo recursos mientras medimos autoscaling en el catálogo.

## Un margen grande no arregla una inicialización incorrecta

Si el proceso no puede leer su configuración o espera indefinidamente una dependencia, dar más tiempo puede retrasar el diagnóstico. Conviene observar el motivo del fallo y decidir si es recuperable con otro arranque.

Startup probe tampoco convierte una migración de base de datos en segura. Si varias réplicas intentan ejecutar la misma operación al iniciar, todavía necesitamos coordinarla y diseñar sus reintentos.

Una inicialización que tarda diez segundos de forma habitual y otra que oscila entre diez segundos y diez minutos requieren entender causas distintas. Elegir umbrales debe basarse en el contrato del servicio y sus observaciones, no en copiar un valor del ejemplo.

## Código completo y pruebas

Compara el [Pod protegido](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/slow-start-pod.json) con el [caso sin startup](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/no-startup-pod.json) en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

Las fases `startup_protected` y `startup_missing_probe` conservan el estado HTTP y los contadores que permiten contrastarlos. El visor no necesita volver a arrancar esos Pods.

## Garantías y límites

Se prueban un retardo sintético, arranque protegido y reinicios sin protección. No se simulan todas las causas de arranque lento ni se recomienda el mismo presupuesto para otras aplicaciones. Un arranque correcto no demuestra que el proceso siga sano minutos después.

## Ejercicio: un arranque que nunca termina

Describe qué esperarías ver si `/startup` permanece en `503` y se agota el presupuesto. Indica qué información necesitas para decidir entre corregir configuración y aumentar margen. Continúa con [readiness](/posts/kubernetes-readiness-probe-trafico).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Tipos de probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/).
- [Configurar startup y proteger arranques lentos](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
- [Estados y reinicios de containers](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/).
