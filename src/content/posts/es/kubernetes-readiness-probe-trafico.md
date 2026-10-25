---
id: "K8S-READINESS"
title: "Readiness probe: retirar tráfico sin reiniciar el container"
published: "2026-10-25T16:05:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-readiness"
slug: "kubernetes-readiness-probe-trafico"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-STARTUP"]
description: "Qué cambia en un EndpointSlice cuando la API deja de estar preparada. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

La API mantiene su proceso activo, pero no puede completar una petición de catálogo. Reiniciarla no resolvería necesariamente el problema. Mientras se recupera, sí necesitamos dejar de elegirla como destino de tráfico normal.

La **readiness probe** expresa esa preparación para atender. Después de [startup](/posts/kubernetes-startup-probe-inicializacion), vamos a provocar una pérdida temporal de readiness y comprobar que cambia el tráfico sin cambiar de Pod ni reiniciar su container.

## Readiness pregunta si esta instancia puede recibir trabajo

Una probe de readiness puede fallar durante el arranque o después de que la aplicación haya estado atendiendo. No representa una promesa permanente de salud obtenida una vez al crear el Pod.

En nuestro manifiesto la comprobación es:

```json
{
  "httpGet": {
    "path": "/ready",
    "port": "http"
  },
  "periodSeconds": 2,
  "failureThreshold": 1
}
```

El handler `/ready` exige inicialización terminada, configuración válida y el flag de preparación de la fixture. El flag se modifica mediante el ConfigMap para reproducir el fallo; no es un endpoint público de administración.

No consultamos una DB real en este ejemplo. En una aplicación con dependencias, el check debería responder al trabajo que puede asumir esa instancia, teniendo en cuenta el coste de comprobarlo y el comportamiento ante fallos compartidos.

## Un endpoint puede seguir registrado y dejar de estar preparado

Cuando la readiness del Pod falla, el estado de los endpoints asociados al Service cambia. En la captura local el EndpointSlice conserva la dirección, con **ready: false**.

Esta distinción importa al diagnosticar. Contar direcciones sin mirar condiciones puede hacer pensar que hay un backend disponible cuando los componentes de routing no deberían usarlo para tráfico regular.

Nuestro Service no activa `publishNotReadyAddresses`. Tampoco estamos estudiando aquí todas las reglas de terminación o draining. La prueba cubre una instancia viva que deja de estar preparada y después se recupera.

<img src="/assets/visuals/kubernetes/K8S-READINESS.svg" alt="La readiness fallida mantiene el Pod vivo y cambia el endpoint a ready false. Traefik devuelve 503 al quedarse sin backend preparado, mientras UID y contador de reinicios permanecen iguales." width="259" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-READINESS.svg).

## El experimento relaciona Pod, endpoint y respuesta

El harness guarda UID y reinicios antes del fallo. Después cambia `ready` a `false`, espera el estado no preparado y comprueba que los endpoints del catálogo están marcados como no listos.

La entrada Traefik devuelve **503** cuando el catálogo se queda sin backend preparado. No imponemos ese código como comportamiento de cualquier proxy; es el resultado observado en esta configuración local.

El UID y el contador de reinicios permanecen iguales. Esa combinación diferencia la retirada de tráfico de un reemplazo o restart. Esperar únicamente un error HTTP no habría demostrado qué hizo Kubernetes.

Al devolver el flag a `true`, el harness espera preparación y una respuesta de catálogo correcta. No lanza otro Deployment para recuperar el caso.

## Una dependencia compartida exige pensar el efecto global

Si todas las réplicas consultan una dependencia caída dentro de su readiness, todas pueden dejar de estar listas. Eso puede ser adecuado si ninguna puede cumplir el contrato, pero también cambia cómo verá el error el cliente y cómo detectaremos la recuperación.

No siempre conviene comprobar cada dependencia en cada probe. Un check caro o con timeout excesivo añade carga y demora. Si existe un modo degradado válido, la preparación debería reflejar las operaciones que aún pueden atenderse, no un ideal abstracto de «todo funciona».

También hay que separar nuevas peticiones y trabajo en curso. Dejar de anunciar una instancia como preparada no cancela automáticamente tareas que ya ejecuta ni garantiza el drenaje instantáneo de todas las conexiones.

## La sensibilidad del check es una decisión del servicio

En el ejemplo usamos un periodo corto y un umbral pequeño para observar transiciones. Esos valores no representan una recomendación universal. Una señal inestable puede retirar y devolver backends continuamente.

Conviene observar frecuencia de fallos, tiempo de recuperación y efecto en peticiones. Añadir réplicas no compensa una señal de readiness incorrecta que las retire a todas.

La comparación con liveness será especialmente útil: una instancia no preparada puede seguir funcionando y necesitar tiempo para recuperarse. Reiniciarla indiscriminadamente podría hacer que repita una preparación costosa.

## Código completo y pruebas

El [manifiesto de API](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/deployment.json) y el [runner de transiciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/scripts/exercise.mjs) están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

Busca `readiness_removed_endpoint` y `readiness_recovered`: cada fase conserva sus datos propios. El visor indica «No capturado» cuando una fase no contiene una observación HTTP.

## Garantías y límites

Se verifica retirada y recuperación local, condiciones de EndpointSlice y ausencia de reinicio en ese fallo. No se prueba draining de conexiones largas, varias réplicas ante una DB caída o disponibilidad continua. La lectura posterior no cubre todas las peticiones de la transición.

## Ejercicio: un check demasiado dependiente

La API puede servir resultados cacheados, pero su DB está caída. Decide qué contrato permitiría mantenerla preparada y cómo lo comunicarías al cliente. Explica qué señal distinguiría degradación de imposibilidad de atender. Continúa con [liveness](/posts/kubernetes-liveness-probe-reinicios).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Probes y decisiones del kubelet](https://kubernetes.io/docs/concepts/workloads/pods/probes/).
- [Condiciones de EndpointSlice](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/).
- [Configurar readiness](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
