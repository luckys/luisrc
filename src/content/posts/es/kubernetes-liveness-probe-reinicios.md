---
id: "K8S-LIVENESS"
title: "Liveness probe: cuándo reiniciar ayuda y cuándo multiplica el problema"
published: "2026-10-25T16:06:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-liveness"
slug: "kubernetes-liveness-probe-reinicios"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-READINESS"]
description: "Cómo distinguir un container bloqueado de una dependencia indisponible. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

Una dependencia falla y todas las réplicas empiezan a reiniciarse. La dependencia sigue caída, pero ahora cada réplica añade su inicialización al problema. El check llamado «de salud» ha provocado una recuperación que no puede arreglar la causa.

La **liveness probe** debe ayudar a identificar cuándo reiniciar ese container puede recuperar progreso. Tras [retirar tráfico con readiness](/posts/kubernetes-readiness-probe-trafico), vamos a comprobar qué identidad cambia durante un restart y qué señales justifican provocarlo.

## Liveness y readiness desencadenan acciones distintas

La liveness fallida por encima de su umbral puede hacer que el kubelet termine y reinicie el container según la política aplicable. No es el mecanismo con el que deberíamos indicar simplemente que ahora no podemos aceptar nuevas peticiones.

Nuestro Deployment contiene este bloque:

```json
{
  "httpGet": {
    "path": "/live",
    "port": "http"
  },
  "periodSeconds": 2,
  "failureThreshold": 2
}
```

El endpoint `/live` comprueba el estado de inicialización y un fallo controlado de la fixture. La startup probe protege la inicialización antes de que liveness actúe.

El flag de fallo reside en el ConfigMap exclusivamente para el experimento. No proponemos que una aplicación de producción haga depender su vida de una orden remota mutable ni que exponga un botón público para reiniciarse.

## Reiniciar el container puede conservar el mismo Pod

Antes del fallo, el harness guarda UID y contador de reinicios. Cambia el flag `live` a `false`, observa que aumenta `restartCount` y después restaura el flag.

El Pod conserva su **UID**. Esa es la diferencia con borrar el Pod y dejar que el Deployment cree otro, como hicimos al comenzar la serie. Aquí el kubelet reinicia una ejecución de container dentro del objeto existente.

Tras recuperar la condición de vida, esperamos readiness y HTTP correcto. El contador puede haber aumentado más de una vez durante la propagación del cambio de configuración; el experimento no inventa un único restart si ocurrieron varios.

<img src="/assets/visuals/kubernetes/K8S-LIVENESS.svg" alt="Un fallo controlado de liveness supera su umbral y el kubelet reinicia el container dentro del mismo Pod. El UID permanece y sube restartCount; después se recupera preparación y respuesta HTTP." width="277" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-LIVENESS.svg).

## Un check debe corresponder a una causa recuperable con restart

Un bloqueo interno que impide progresar puede ser un motivo para reiniciar. Un error de permisos permanente o una dependencia externa caída normalmente requieren otra acción. Reiniciar no crea un permiso ni devuelve disponibilidad a un tercero.

Si el proceso ya termina por sí mismo al detectar un fallo irrecuperable, la política de reinicio puede ser suficiente para ese caso. No hay que añadir una probe redundante sin saber qué fallo nuevo detecta.

La liveness también puede fallar por latencia de CPU o por un endpoint demasiado caro. Un timeout corto bajo saturación puede matar precisamente a la réplica que aún estaba avanzando lentamente. La señal debe evaluarse con recursos, carga y comportamiento del runtime.

El ejemplo tiene carga CPU controlada en una fase posterior, pero no usamos ese recorrido para afirmar que cualquier timeout sea correcto. El valor de un laboratorio está en reproducir decisiones, no en convertir sus segundos en una plantilla universal.

## Los reinicios repetidos también consumen presupuesto

Cada restart puede volver a abrir conexiones, cargar datos, calentar caches y producir trabajo para las dependencias. Repetirlo rápidamente puede retrasar la recuperación y amplificar el incidente.

Al investigar conviene mirar causas de terminación, eventos, logs relevantes y contadores, además del estado actual. Un proceso que ahora funciona puede haber sufrido una secuencia de fallos que su último `200` no muestra.

Si hay un **OOMKilled**, no lo confundiremos con el fallo de una liveness. Más adelante provocaremos un límite de memoria en un Pod separado y comprobaremos el motivo de terminación. El mismo contador de reinicios no identifica por sí solo la causa.

## Configurar el umbral exige medir el comportamiento

El periodo, timeout y umbral determinan cuánto margen damos al check. Un umbral demasiado estricto puede crear reinicios innecesarios; uno demasiado permisivo puede dejar una instancia bloqueada durante más tiempo.

La decisión debería partir de qué indica el endpoint y cuánto puede tardar de forma aceptable. Copiar la misma ruta y valores de readiness puede ocultar que esperamos respuestas operativas diferentes.

En nuestra API un fallo de configuración normal puede dejar readiness en `503` sin activar por ello el flag explícito de fallo de liveness. El experimento mantiene separadas esas causas para que podamos observarlas.

## Código completo y pruebas

Consulta la [API de fallos controlados](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/app/server.mjs) y el [Deployment](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/deployment.json) en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads test
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

La fase `liveness_restarted` conserva el antes y después. Los tests rápidos distinguen readiness fallida de liveness fallida; el recorrido Kubernetes comprueba su efecto real.

## Garantías y límites

Se observa un restart por la fixture de liveness y recuperación posterior. No se ha reproducido un deadlock real, una caída de DB o todos los escenarios de saturación. El fallo controlado sirve para estudiar el mecanismo, no para certificar un check de producción.

## Ejercicio: elegir la acción que sí puede ayudar

Clasifica un deadlock, una credencial inválida y una dependencia temporalmente caída. Explica en cuáles un restart podría recuperar progreso y qué evidencia necesitarías antes de automatizarlo. Continúa con [ConfigMaps](/posts/kubernetes-configmaps-env-volumenes).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Liveness y sus efectos](https://kubernetes.io/docs/concepts/workloads/pods/probes/).
- [Configuración de probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
- [Reinicios y ciclo de vida](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/).
