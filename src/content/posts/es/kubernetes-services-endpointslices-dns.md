---
id: "K8S-SERVICES"
title: "Services, EndpointSlices y DNS: encontrar una API aunque cambien sus Pods"
published: "2026-10-25T16:02:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-services"
slug: "kubernetes-services-endpointslices-dns"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-DEPLOYMENTS"]
description: "Cómo relacionar nombre estable, selector, puerto y backends listos. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

La aplicación cliente guarda la IP de un Pod y deja de conectar después de una actualización. La API está funcionando en otro Pod, pero el cliente sigue intentando alcanzar una instancia que ya no representa al servicio.

Un **Service** ofrece una referencia estable para llegar a backends que pueden cambiar. Después de [Deployment y rollout](/posts/kubernetes-deployments-replicasets-rollout), vamos a separar nombre DNS, dirección de servicio y endpoints preparados.

## Un Service selecciona backends mediante labels

Este es el manifiesto `service.json` del catálogo; el harness añade el namespace propio de cada ejecución:

```json
{
  "apiVersion": "v1",
  "kind": "Service",
  "metadata": {
    "name": "catalogue"
  },
  "spec": {
    "type": "ClusterIP",
    "selector": {
      "app": "catalogue"
    },
    "ports": [
      {
        "port": 80,
        "targetPort": "http"
      }
    ]
  }
}
```

`selector` busca Pods con `app: catalogue`. El puerto del Service es `80`; `targetPort: http` se refiere al puerto nombrado `http` del container, que en nuestra API corresponde a `3000`.

La declaración de un puerto no hace que el proceso escuche en él. Deben coincidir nombre, número y configuración real del servidor. Un Service correcto sobre un proceso que no escucha sigue sin producir una operación útil.

**ClusterIP** proporciona una dirección virtual de servicio accesible en la red del clúster. No es una publicación automática en internet ni una IP que tengamos que asignar a un Pod.

<img src="/assets/visuals/kubernetes/K8S-SERVICES.svg" alt="Un Pod cliente resuelve el nombre del Service a una ClusterIP. El plano de datos utiliza destinos descritos por EndpointSlices para alcanzar un Pod preparado en el puerto nombrado de la API." width="294" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-SERVICES.svg).

## EndpointSlices describen destinos y condiciones

Los **EndpointSlices** asociados al Service registran direcciones, puertos y condiciones de los endpoints. Permiten distribuir esa información sin exigir un único objeto enorme para todos los destinos.

La condición **ready** indica si un endpoint puede usarse para tráfico regular según las reglas aplicables. Un endpoint que deja de estar preparado puede seguir apareciendo con `ready: false`; no debemos contar cualquier dirección presente como un backend listo.

Existen matices como endpoints en terminación y Services con `publishNotReadyAddresses`. El laboratorio no activa esa opción. Más adelante observaremos una readiness fallida sobre el caso normal del catálogo.

Para diagnosticar, conviene revisar el Service, sus selectors y los EndpointSlices antes de culpar a DNS. Un nombre puede resolver perfectamente hacia una dirección virtual cuyo conjunto de backends disponibles está vacío.

## DNS resuelve el servicio, no decide la salud del catálogo

Dentro del clúster consultamos `catalogue.<namespace>.svc.cluster.local`. El nombre identifica este Service dentro de su namespace y dominio de clúster. El sufijo concreto del clúster es una configuración, no un formato que debamos asumir en todos los entornos.

En el ejercicio, la resolución devuelve la ClusterIP y una petición al mismo nombre devuelve el catálogo. Guardamos ambas observaciones. Resolver un nombre y completar HTTP son dos pruebas diferentes.

Utilizamos un Pod cliente separado de la API. Así la prueba representa una llamada entre workloads y no depende de que un Pod pueda acceder a sí mismo mediante la dirección del Service, un recorrido con sus propios detalles de red.

El DNS del clúster tampoco sustituye todos los pasos posteriores. Una regla de red puede impedir tráfico; el puerto puede ser erróneo; la aplicación puede responder un error. Separar resolución, conexión y respuesta ayuda a localizar el fallo.

## Kube-proxy y la red materializan el recorrido

La abstracción Service necesita una implementación del plano de datos. **kube-proxy**, en las configuraciones que lo utilizan, programa reglas para dirigir tráfico hacia backends. Otras implementaciones pueden resolver ese trabajo con mecanismos diferentes.

El API de Service no obliga a un único detalle interno de reenvío. Por eso el artículo no convierte el funcionamiento de este K3s local en una descripción universal de todas las redes Kubernetes.

Tampoco promete un reparto exactamente uniforme por petición. Conexiones reutilizadas y comportamiento del cliente o proxy pueden influir. Nuestro experimento valida resolución y una operación, no la distribución estadística de tráfico.

## Código completo y pruebas

El [Service](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/service.json), el [Pod cliente](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/client-pod.json) y el harness están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

La captura `service_dns` incluye nombre consultado, dirección resuelta, ClusterIP, HTTP y endpoints. Las direcciones pertenecen a un clúster efímero ya eliminado; el visor no se conecta a ellas.

## Garantías y límites

Se prueba DNS y HTTP internos de un Service ClusterIP local. No hay varios nodos, NetworkPolicy, headless Service, balanceo estadístico o Service de proveedor cloud probado. Una ClusterIP no demuestra exposición externa.

## Ejercicio: DNS funciona y HTTP no

El nombre resuelve, pero no hay endpoints preparados. Enumera qué comprobarías en selector, labels, readiness y puerto. Explica por qué cambiar el servidor DNS no recuperaría por sí solo esos backends. Continúa con [Ingress](/posts/kubernetes-ingress-controller-host-rutas).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Service](https://kubernetes.io/docs/concepts/services-networking/service/).
- [EndpointSlices y condiciones](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/).
- [DNS para Services y Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/).
