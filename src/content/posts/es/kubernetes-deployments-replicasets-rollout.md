---
id: "K8S-DEPLOYMENTS"
title: "Deployment y ReplicaSet: cambiar de versión y recuperar la anterior"
published: "2026-10-25T16:01:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-deployments"
slug: "kubernetes-deployments-replicasets-rollout"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-PODS"]
description: "Qué mantiene un Deployment y qué demuestra realmente un rollout. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

La nueva versión arranca en un Pod, pero el servicio sigue enviando parte del tráfico a la anterior. Eso puede ser una fase normal del despliegue o una actualización atascada. Para distinguirlo hay que mirar qué mantiene el Deployment y qué versiones están preparadas.

Venimos de [identidad y reposición de Pods](/posts/kubernetes-pods-api-controladores). Ahora cambiaremos realmente entre dos images de la API y volveremos a la anterior, sin confundir una revisión de configuración con una restauración de datos.

## El Deployment declara un objetivo sobre una plantilla de Pods

El **Deployment** contiene una plantilla y una cantidad deseada de réplicas. Para gestionarlas utiliza **ReplicaSets**. Cambiar la plantilla, por ejemplo la referencia de image, inicia una actualización; cambiar solo el número deseado no es lo mismo que publicar una plantilla nueva.

El selector debe corresponder a las labels de los Pods que gestionará. Si la API se llama `catalogue`, no basta con que otro Pod tenga un nombre parecido. Los controladores y el Service se apoyan en campos declarados, no en semejanzas del nombre.

En nuestro manifiesto, `spec.strategy` contiene:

```json
{
  "type": "RollingUpdate",
  "rollingUpdate": {
    "maxSurge": 1,
    "maxUnavailable": 0
  }
}
```

**maxSurge: 1** permite una réplica adicional durante el rollout y **maxUnavailable: 0** limita cuántas pueden faltar respecto al objetivo. Son restricciones de la estrategia, no una prueba de capacidad o de cero errores de usuario.

## Preparar una réplica nueva consume recursos

Con una réplica deseada y un surge de uno, la transición puede necesitar sitio para dos Pods. Si el nodo no tiene recursos solicitados suficientes, el reemplazo puede quedar pendiente mientras la versión anterior continúa.

La nueva réplica necesita obtener su image, montar configuración y superar las comprobaciones pertinentes. Más adelante estudiaremos las probes que deciden cuándo se considera preparada.

Si la aplicación requiere un cambio de esquema incompatible, mantener ambas versiones vivas no arregla esa incompatibilidad. Las decisiones de [despliegue y datos](/posts/rollback-aplicacion-esquema-datos-compatibles) siguen aplicando dentro de Kubernetes.

<img src="/assets/visuals/kubernetes/K8S-DEPLOYMENTS.svg" alt="Un cambio de image en la plantilla del Deployment inicia un rollout gestionado mediante ReplicaSets y Pods preparados. HTTP verifica la versión v2; undo recupera la plantilla previa sin restaurar datos externos." width="288" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-DEPLOYMENTS.svg).

## Dos images diferentes permiten observar la versión que respondió

El laboratorio construye `v1` y `v2` con el mismo servidor, pero escribe una versión distinta dentro de cada image durante el build. Importa ambas en el containerd del clúster local. Sus image IDs difieren.

No cambiamos una variable externa y la presentamos como otra image. El endpoint devuelve la versión leída del archivo incluido en la image. La fase `rollout_v2` exige HTTP `200` y `version: v2` después de esperar el rollout.

Los tags son locales y propios de la ejecución. No son referencias a un registry público ni una demostración de firmas de artefactos. El harness conserva los IDs para describir qué construyó e importó.

## Rollout status y HTTP aportan evidencias distintas

Esperar `rollout status` permite saber que la actualización alcanza las condiciones que supervisa el controlador. Después necesitamos probar la operación que importa a la aplicación.

Un endpoint de salud puede responder correctamente mientras una función de negocio tiene un error. Aquí la comprobación HTTP exige la versión esperada, no solo cualquier `200`. Sigue siendo una prueba pequeña del catálogo ficticio, no una suite exhaustiva.

Tampoco enviamos tráfico continuo durante toda la transición. Una lectura posterior no basta para afirmar que ninguna petición falló mientras convivían las réplicas.

## Rollout undo recupera una plantilla; no deshace el mundo exterior

El siguiente paso ejecuta `rollout undo` y espera volver a `v1`. El resultado HTTP verifica la versión anterior. Esa operación utiliza el historial de revisiones disponible del Deployment.

No revierte una escritura en una DB, un correo enviado o el contenido actual de un ConfigMap mutable por el hecho de recuperar una plantilla. La estrategia de configuración y datos condiciona si la versión anterior puede funcionar.

Conservar historial tampoco evita que una image desaparezca del registry o que falten permisos para obtenerla. La posibilidad de recuperar un artefacto y la compatibilidad de sus dependencias tienen que formar parte de la entrega.

## Código completo y pruebas

Consulta el [Deployment](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/deployment.json) y el [Dockerfile de ambas versiones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/Dockerfile) en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

Las fases separan sustitución del Pod, publicación de `v2` y vuelta a `v1`. El runner no utiliza un clúster externo ni un artefacto que dependa de credenciales de registry.

## Garantías y límites

Se comprueban dos images locales, rollout y undo con respuestas posteriores. No se ensaya una migración, continuidad bajo carga o pérdida de nodo. Las restricciones de rollout no sustituyen esas pruebas.

## Ejercicio: una actualización sin espacio para el surge

Con una réplica deseada, dibuja qué ocurre si no cabe la réplica adicional. Decide qué revisarías antes de aumentar indiscriminadamente límites o permitir indisponibilidad. Continúa con [Services y DNS](/posts/kubernetes-services-endpointslices-dns).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Deployments y RollingUpdate](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).
- [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/).
- [Gestión de images](https://kubernetes.io/docs/concepts/containers/images/).
