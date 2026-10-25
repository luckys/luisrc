---
id: "K8S-RESOURCES"
title: "Requests y limits: reservar sitio, limitar consumo y entender un OOMKilled"
published: "2026-10-25T16:09:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-resources"
slug: "kubernetes-requests-limits-scheduling-oom"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-SECRETS"]
description: "Por qué un Pod puede quedar Pending o morir por memoria aunque haya CPU libre. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

Un Pod queda en Pending aunque el nodo parece tener CPU libre. Otro arranca y termina con OOMKilled. Son fallos diferentes: uno puede no encontrar sitio según lo que solicita; el otro puede superar la memoria permitida durante su ejecución.

Después de [identidades y permisos](/posts/kubernetes-secrets-serviceaccounts-rbac), vamos a distinguir **requests**, **limits** y consumo observado. El laboratorio provocará ambos casos en Pods separados del catálogo.

## Requests influyen en dónde puede ejecutarse un Pod

Las **requests** declaran recursos que necesita la carga para decisiones como el scheduling. El scheduler compara solicitudes con capacidad asignable y otras restricciones, no solo con una fotografía del uso actual del nodo.

CPU libre en este instante no significa que podamos prometerla a cualquier carga nueva. Si otros Pods ya han solicitado capacidad, esa asignación influye en la decisión. Afinidad, taints y otras condiciones también pueden dejar un Pod sin nodo.

En CPU, `1000m` representa un core; `50m` son 0,05 cores. La letra `m` no significa milisegundos. En memoria, unidades como `Mi` y `M` tampoco representan exactamente la misma cantidad.

## Limits condicionan el consumo durante la ejecución

La API del catálogo declara este bloque de recursos:

```json
{
  "requests": {
    "cpu": "50m",
    "memory": "32Mi"
  },
  "limits": {
    "cpu": "250m",
    "memory": "96Mi"
  }
}
```

La request y el limit responden a preguntas distintas. El límite CPU se puede materializar en throttling, sin que el proceso muera necesariamente. El consumo de memoria puede llevar a terminación por OOM según el mecanismo y presión correspondientes.

No es correcto interpretar «uso el 100% de mi request» como «agoté el nodo» o «alcancé mi limit». Esas tres referencias pueden ser distintas. La diferencia será clave al leer las métricas del HPA.

Configurar un limit tampoco optimiza una aplicación. Si el presupuesto no permite su funcionamiento, puede aumentar latencia o provocar terminaciones. Necesitamos observar demanda y comportamiento bajo la carga que importa.

<img src="/assets/visuals/kubernetes/K8S-RESOURCES.svg" alt="Un Pod con request CPU imposible queda Pending sin nodo, por Insufficient cpu. En otro experimento independiente, una asignación de 256Mi bajo limit de 64Mi produce la razón de terminación OOMKilled." width="306" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-RESOURCES.svg).

## Un request imposible permite observar el fallo de scheduling

El Pod `unschedulable` pide una cantidad de CPU deliberadamente imposible para el nodo local. El harness espera una condición **PodScheduled** con razón **Unschedulable** y un mensaje que indica **Insufficient cpu**.

La captura conserva `Pending` y ausencia de asignación a un nodo. No aceptamos simplemente que no responda HTTP: eso podría tener muchas otras causas.

El Pod se elimina después del experimento. No cambiamos la capacidad real ni añadimos nodos para conseguir que una solicitud didáctica desproporcionada se vuelva viable.

En un caso real habría que revisar si la request está justificada, qué capacidad está asignada y si el diseño requiere más nodos o otra distribución. Bajar valores hasta que el Pod quepa puede esconder la demanda que realmente necesita.

## El caso de memoria verifica OOMKilled, no solo un exit code

Otro Pod tiene un límite de **64 MiB** e intenta asignar y tocar un buffer de **256 MiB**. El comando procede de esta fixture:

```json
[
  "node",
  "-e",
  "const held=Buffer.alloc(256*1024*1024,1);setInterval(()=>held[0],1000)"
]
```

El experimento se ejecuta dentro del container limitado del clúster local. El harness espera que Kubernetes registre **OOMKilled** como razón de terminación. No deduce la causa únicamente de un código de salida o de que el proceso haya desaparecido.

Su `restartPolicy` es `Never`: queremos observar esa terminación sin dejar un bucle de reinicios. Es un Pod negativo independiente, no una versión del catálogo enviada a usuarios.

Un OOM real podría exigir corregir una fuga, limitar el tamaño del trabajo, reducir concurrencia o ajustar un presupuesto justificado. Aumentar memoria sin investigar puede aplazar el fallo y aumentar coste.

## Medir uso y dimensionar solicitudes es un trabajo continuo

Las métricas ayudan a comparar request, uso, límites y resultados de aplicación. Una media baja puede ocultar picos relevantes; un valor alto puede ser normal si aún cumple latencia y tiene margen apropiado.

También conviene observar cuántas réplicas y conexiones multiplican ese consumo. El presupuesto por Pod y el del servicio completo no son la misma cifra.

Esta prueba no mide throttling CPU ni hace ingeniería de capacidad de producción. Su objetivo es demostrar que Pending y OOMKilled requieren diagnósticos y acciones diferentes, con motivos observables.

## Código completo y pruebas

Consulta el [Pod no planificable](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/unschedulable-pod.json) y el [Pod de memoria](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/oom-pod.json) en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

## Garantías y límites

Se observan scheduling rechazado por CPU y terminación OOMKilled bajo un límite de memoria. No se mide throttling, eviction del nodo, QoS bajo contención o capacidad de producción. Las cifras son fixtures controladas, no recomendaciones de dimensionamiento.

## Ejercicio: request, uso y limit en la misma gráfica

Sitúa 50m de request, 100m de consumo hipotético y 250m de limit. Explica qué porcentaje obtendrías respecto a cada referencia y cuál utilizaría el HPA de CPU configurado por utilización. Continúa con [autoscaling](/posts/kubernetes-hpa-metricas-escalado).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Recursos de containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/).
- [Asignar memoria y observar límites](https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/).
- [Scheduling](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/).
