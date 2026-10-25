---
id: "K8S-HPA"
title: "HPA: observar cómo las métricas cambian las réplicas de una API"
published: "2026-10-25T16:10:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-hpa"
slug: "kubernetes-hpa-metricas-escalado"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-RESOURCES"]
description: "Cómo interpretar CPU relativa a requests, estabilización y escalado real. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

El objeto HPA existe, pero la aplicación conserva una réplica mientras recibe carga. Puede faltar una métrica, no estar configurada la request que sirve de referencia o haberse aplicado un objetivo que no corresponde al cuello de botella.

Un **HorizontalPodAutoscaler** observa métricas y ajusta la cantidad deseada de réplicas de una carga compatible. Después de [requests y limits](/posts/kubernetes-requests-limits-scheduling-oom), vamos a comprobar aumento y reducción de réplicas sobre la API real del laboratorio.

## La utilización CPU del HPA se calcula respecto a requests

Nuestro container solicita **50m** de CPU y tiene un límite de **250m**. Un consumo hipotético de 50m representa el 100% de su request, aunque esté lejos del límite y no agote la CPU del nodo.

El objetivo del HPA es el **50%** de esa request: como referencia numérica para un container del ejemplo, 25m. No es el 50% del nodo ni el 50% del limit.

Una aproximación al cálculo básico es:

`réplicas deseadas = ceil(réplicas actuales × métrica actual / métrica objetivo)`

Con una réplica al 100% de utilización y objetivo del 50%, la cuenta básica propone dos. Tolerancias, métricas ausentes, Pods todavía no preparados, límites y políticas pueden cambiar la decisión final. No implementamos un simulador simplificado y lo presentamos como el controlador real.

## Metrics Server y el HPA cumplen funciones distintas

**Metrics Server** suministra métricas de recursos en la configuración del clúster. Tenerlo instalado no demuestra que el HPA reciba muestras válidas ni que haya escalado una aplicación.

El harness espera una métrica CPU disponible en el estado del HPA antes de comenzar la carga. Después conserva muestras con utilización, réplicas deseadas, actuales y preparadas.

En la captura, antes de tener CPU válida, el status del HPA muestra inicialmente cero réplicas deseadas mientras ya hay una preparada. Conservamos ese estado con contexto, pero no lo trazamos como una recomendación de escalar a cero. El estado del HPA y el del Deployment también pueden actualizarse en momentos distintos; la lectura conjunta no es un snapshot atómico del clúster.

También hace falta sitio para nuevas réplicas y un scheduler que pueda ubicarlas. El HPA puede pedir más Pods sin crear automáticamente nuevos nodos. Escalado de workloads y escalado de nodos son mecanismos diferentes.

## El manifiesto limita y estabiliza decisiones

Este es `spec` de nuestro HPA:

```json
{
  "scaleTargetRef": {
    "apiVersion": "apps/v1",
    "kind": "Deployment",
    "name": "catalogue"
  },
  "minReplicas": 1,
  "maxReplicas": 3,
  "metrics": [
    {
      "type": "Resource",
      "resource": {
        "name": "cpu",
        "target": {
          "type": "Utilization",
          "averageUtilization": 50
        }
      }
    }
  ],
  "behavior": {
    "scaleDown": {
      "stabilizationWindowSeconds": 30,
      "policies": [
        {
          "type": "Pods",
          "value": 3,
          "periodSeconds": 15
        }
      ]
    },
    "scaleUp": {
      "stabilizationWindowSeconds": 0,
      "policies": [
        {
          "type": "Pods",
          "value": 2,
          "periodSeconds": 15
        }
      ]
    }
  }
}
```

La referencia apunta al Deployment del catálogo. El rango es de una a tres réplicas. La ventana de reducción se fija en treinta segundos para observar la recuperación en un recorrido corto; no es una recomendación de ese valor para producción.

Las políticas también acotan cuánto puede variar el objetivo en cada periodo. No son un plazo garantizado para tener Pods listos. Crear un Pod, inicializarlo y hacerlo elegible para tráfico añade sus propios pasos.

Este experimento gestiona la aplicación directamente con Kubernetes en un clúster propio. No ejecuta un apply Terraform que restablezca simultáneamente `replicas: 1`. La propiedad del campo debe estar clara cuando ambas herramientas se combinan.

<img src="/assets/visuals/kubernetes/K8S-HPA.svg" alt="El HPA observa métricas CPU relativas a requests y aplica un objetivo con límites y políticas. Cambia réplicas deseadas y espera preparación; después de retirar la carga se observa reducción de réplicas." width="286" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-HPA.svg).

## La carga debe existir fuera del manifiesto

El runner utiliza ocho clientes que envían peticiones a `/work?ms=20` mediante el Ingress. Ese endpoint ejecuta un trabajo CPU sintético y acotado. No representa una consulta de negocio ni una prueba comparativa de lenguajes.

La fase de aumento exige observar al menos dos réplicas preparadas, un objetivo mayor que uno y una muestra CPU por encima del target. No damos por válido el escalado por haber escrito `maxReplicas: 3` en un archivo.

Después detenemos los clientes y seguimos observando hasta recuperar una réplica deseada y preparada. Se registran las peticiones correctas y fallidas de la carga; la prueba no oculta un error convirtiéndolo en respuesta correcta.

El gráfico se genera con las muestras archivadas, no con una curva ideal de «sube y baja»:

<img src="/assets/interactive/kubernetes-workloads/hpa-observations.svg" alt="Muestras del HPA local comparan réplicas deseadas y preparadas durante baseline, carga CPU sintética y recuperación. Los puntos provienen del recorrido observado; no representan throughput o tiempos garantizados." width="380" height="420" loading="lazy" style="width:100%;height:auto" />

[Ampliar el gráfico](/assets/interactive/kubernetes-workloads/hpa-observations.svg).

<iframe src="/assets/interactive/kubernetes-workloads/explorer.html" title="Explorar fases y métricas observadas de Kubernetes" loading="lazy" width="100%" height="1500" style="border:0;border-radius:12px"></iframe>

[Abrir el visor](/assets/interactive/kubernetes-workloads/explorer.html).

## CPU no siempre es la señal adecuada

Si el trabajo espera una dependencia lenta, puede aumentar la latencia sin consumir mucha CPU. Un HPA basado únicamente en CPU podría no reaccionar al problema que queremos resolver.

La métrica debe corresponder a una relación útil entre trabajo pendiente, capacidad y resultados. Añadir réplicas también puede multiplicar conexiones y presión sobre una dependencia que ya está saturada.

La estabilización reduce reacciones a señales breves, pero introduce una compensación con la rapidez de respuesta. Necesitamos evaluar esa decisión con el patrón real de carga, no solo con una media mensual de peticiones.

## Código completo y pruebas

Consulta el [HPA](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/hpa.json), el [harness y carga](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/scripts/exercise.mjs) y las muestras en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
pnpm --dir packages/kubernetes-workloads render
```

## Garantías y límites

Se observan métricas, aumento y reducción de réplicas en un nodo local. No hay autoscaling de nodos, benchmark de throughput, HA, escalado en cloud o capacidad de producción certificados. Las duraciones pertenecen a este recorrido y no constituyen un SLA del HPA.

## Ejercicio: elegir una métrica para trabajo que espera

Una API pasa casi todo el tiempo esperando conexiones a un proveedor. Explica por qué CPU podría ser una señal insuficiente y qué medirías antes de aumentar réplicas. Conserva esa pregunta para P066, donde profundizaremos en capacidad y costes.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).
- [Recursos y requests](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/).
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server).
