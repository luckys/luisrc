---
id: "K8S-PODS"
title: "Kubernetes: qué es un Pod y quién mantiene la aplicación ejecutándose"
published: "2026-10-25T16:00:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-pods"
slug: "kubernetes-pods-api-controladores"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["TF-CHANGES"]
description: "Cómo separar API, scheduler, kubelet y controladores al observar un Pod. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

El proceso vuelve a aparecer después de borrarlo y alguien concluye que «Docker lo ha reiniciado». En Kubernetes pueden estar ocurriendo dos cosas distintas: reiniciar un container dentro del mismo Pod o crear otro Pod para mantener una aplicación.

Después de [Terraform y sus cambios revisados](/posts/terraform-planes-guardados-reemplazos-recuperacion), empezamos el bloque de **Kubernetes** con una API de catálogo ficticia. Vamos a seguir objetos, identidades y controladores, antes de añadir tráfico y escalado.

## Un Pod es una unidad de ejecución con identidad propia

Un **Pod** agrupa uno o varios containers que comparten un contexto de ejecución, como red y volúmenes declarados. Nuestro Pod contiene un único container de API. No añadimos un sidecar para explicar un concepto que todavía no lo necesita.

El nombre permite localizar el objeto; el **UID** identifica esa instancia del objeto. Un Pod nuevo puede cumplir la misma función que otro y tener una identidad diferente. La aplicación no debería depender de que una IP de Pod dure para siempre.

Cuando un container reinicia, el objeto Pod puede conservar su UID y aumentar su contador de reinicios. Cuando un controlador sustituye el Pod, aparece otro UID. Ese dato permite investigar sin llamar «restart» a cualquier cambio que veamos.

## El API, el scheduler y el kubelet hacen trabajos diferentes

El **API server** recibe y valida operaciones sobre objetos. Los controladores observan estado y actúan para acercarlo al objetivo declarado. El **scheduler** selecciona un nodo para un Pod pendiente de asignación. En el nodo, el **kubelet** coordina su ejecución con el container runtime.

Son responsabilidades, no un único proceso mágico que despliega una aplicación completa. Un objeto aceptado puede seguir sin nodo, sin image o sin estar preparado para recibir peticiones.

En el laboratorio usamos **K3s**, una distribución que reúne componentes para ejecutar un clúster local de un nodo. Esa comodidad no cambia las responsabilidades conceptuales ni convierte el portátil en un entorno de alta disponibilidad.

<img src="/assets/visuals/kubernetes/K8S-PODS.svg" alt="El API conserva objetos deseados y los controladores mantienen réplicas creando Pods con UID propio. El scheduler asigna un nodo y el kubelet coordina la ejecución con el runtime; son responsabilidades distintas." width="255" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-PODS.svg).

## Declarar un Pod aislado no pide mantener una réplica de la aplicación

Puedes crear un Pod directamente para un experimento puntual. Para una API que debe conservar un número de réplicas utilizaremos un **Deployment**, que gestiona ReplicaSets y, mediante ellos, Pods.

Esa relación explica la prueba de borrado. No esperamos que el objeto Pod borrado reviva. Esperamos que el controlador cree otro para recuperar la cantidad deseada.

El runner resume estas propiedades del Pod observado:

```javascript
const podInfo = (pod) => ({
  name: pod.metadata.name,
  uid: pod.metadata.uid,
  ready: pod.status.conditions?.some(
    (c) => c.type === 'Ready' && c.status === 'True'
  ) ?? false,
  restarts: pod.status.containerStatuses?.[0]?.restartCount ?? 0,
  image: pod.spec.containers[0].image,
  imageId: pod.status.containerStatuses?.[0]?.imageID ?? null,
  owner: pod.metadata.ownerReferences?.[0]?.kind ?? null,
  phase: pod.status.phase
})
```

El contador `restarts` corresponde al primer container porque este ejemplo tiene uno solo. En un Pod con varios habría que inspeccionar cada estado. El helper tampoco convierte `Running` en `Ready`: son datos diferentes.

## Comprobar la sustitución requiere mirar algo más que el nombre

La fase `pod_replaced` guarda el Pod anterior y el posterior. Exige UID distinto e image ID igual, además de una lectura HTTP correcta. Comprueba también la relación del ReplicaSet con el Deployment.

El UID distinto demuestra sustitución del objeto. La image ID conserva la identidad de la image ejecutada en ese recorrido. HTTP comprueba el servicio después de la reposición. Ninguno de esos datos, aislado, demuestra que no hubiera un intervalo de indisponibilidad.

No hemos apagado el nodo. Recuperar un Pod dentro de un único nodo sano es una prueba distinta de mantener servicio cuando ese nodo desaparece. Añadir otro nodo tampoco resolvería automáticamente todos los datos, rutas y límites del servicio.

## Namespaces ayudan a organizar; no aíslan por sí solos la red

Cada ejecución crea un namespace con nombre aleatorio. Así sus objetos y permisos pueden delimitarse y eliminarse juntos. El harness solo opera contra su propio clúster, sin utilizar el kubeconfig personal del usuario.

Un namespace no establece automáticamente todas las reglas de acceso o comunicación entre Pods. Las políticas de autorización y red requieren decisiones específicas. En esta serie probaremos RBAC; no presentaremos un namespace como prueba de aislamiento de red.

## Código completo y pruebas

El [laboratorio Kubernetes workloads](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/README.md) vive en el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git):

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir packages/kubernetes-workloads test
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

Requiere Docker Linux capaz de ejecutar K3s privilegiado. El script crea un clúster efímero, ejecuta experimentos y elimina sus recursos propios. `verify` revisa la captura sin volver a iniciar Kubernetes. Las versiones y digests están fijados en el proyecto.

## Garantías y límites

Se observa reposición de un Pod, identidad de image y respuesta posterior. No hay caída de nodo, almacenamiento persistente, NetworkPolicy, varias zonas o disponibilidad continua probados.

## Ejercicio: distinguir dos incidentes por su identidad

Compara un cambio de UID con un aumento de `restartCount` que conserva el UID. Explica qué objeto investigarías en cada caso y qué dato adicional necesitas para atribuir la causa. Continúa con [Deployment y ReplicaSet](/posts/kubernetes-deployments-replicasets-rollout).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Arquitectura del clúster](https://kubernetes.io/docs/concepts/architecture/).
- [Pods](https://kubernetes.io/docs/concepts/workloads/pods/).
- [Ciclo de vida del Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/).
