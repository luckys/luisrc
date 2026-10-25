---
id: "K8S-CONFIG"
title: "ConfigMaps: por qué cambia un archivo y una variable de entorno sigue igual"
published: "2026-10-25T16:07:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-config"
slug: "kubernetes-configmaps-env-volumenes"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-LIVENESS"]
description: "Qué se actualiza al proyectar configuración y qué requiere nuevos containers. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

Cambia un ConfigMap y una petición devuelve el mensaje nuevo, pero la variable de entorno del proceso sigue mostrando el anterior. No es necesariamente una actualización a medias del API: estamos usando dos formas distintas de entregar configuración.

Después de [liveness y reinicios](/posts/kubernetes-liveness-probe-reinicios), vamos a observar qué sucede al proyectar un **ConfigMap** como archivo y al utilizarlo para crear una variable de entorno.

## Un ConfigMap guarda configuración no sensible

Un ConfigMap permite separar datos de configuración de la image. No es el lugar adecuado para guardar una contraseña porque su nombre resulte menos sospechoso que `password.env`.

Nuestro ejemplo contiene dos entradas: `settings.json`, un documento de configuración que se proyecta como archivo, y `envMessage`, utilizado al crear el entorno del container. El mensaje es ficticio y los flags de probes sirven únicamente para los experimentos.

Separar configuración de image permite cambiarla sin reconstruir el artefacto. También exige poder identificar qué combinación estaba ejecutándose. Conservar una image no garantiza recuperar el contenido anterior de un ConfigMap mutable.

## Una variable de entorno se fija al crear el container

El fragmento que entrega `ENV_MESSAGE` al proceso está dentro de la lista `env`:

```json
{
  "name": "ENV_MESSAGE",
  "valueFrom": {
    "configMapKeyRef": {
      "name": "catalogue-settings",
      "key": "envMessage"
    }
  }
}
```

Kubernetes utiliza la referencia al crear el entorno del container. Actualizar después el ConfigMap no reescribe la memoria del proceso ni su entorno existente.

Para obtener el valor nuevo mediante este mecanismo hace falta iniciar containers con la configuración actual. En el experimento lo hacemos con un rollout restart del Deployment, esperando a sus nuevas réplicas preparadas.

Ese restart es una decisión explícita del harness. No afirmamos que el cambio del ConfigMap haya provocado por sí solo una nueva revisión de plantilla o una reconstrucción de image.

## Un volumen proyectado puede recibir actualizaciones después

El container monta la configuración mediante este bloque:

```json
{
  "name": "settings",
  "mountPath": "/config",
  "readOnly": true
}
```

El volumen se conecta al ConfigMap en la especificación del Pod. El kubelet puede actualizar los archivos proyectados cuando cambia su contenido. La propagación no es instantánea; por eso el harness espera el mensaje esperado en HTTP.

La aplicación lee `/config/settings.json` en cada operación del catálogo. Si lo leyese una vez al arrancar y guardase el resultado, actualizar el archivo no obligaría al programa a utilizarlo de nuevo.

También hay diferencias según el montaje: un uso mediante `subPath` no debe asumirse equivalente al volumen proyectado completo del ejemplo. La forma de consumo es parte del contrato, no un detalle que pueda cambiarse sin revisar la actualización.

<img src="/assets/visuals/kubernetes/K8S-CONFIG.svg" alt="Actualizar ConfigMap modifica con propagación eventual el archivo que relee la API. El entorno del mismo proceso conserva el valor anterior y solo los containers nuevos reciben la variable nueva." width="313" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-CONFIG.svg).

## La prueba mantiene el Pod mientras cambia el archivo

La fase `config_volume_changed_env_stale` cambia a la vez el mensaje del archivo y la entrada de entorno del ConfigMap. Espera una respuesta con **volume-v2** y exige que `envMessage` siga siendo **env-v1**.

El Pod observado permite contrastar la identidad antes y después. No necesitamos reiniciarlo para leer el archivo nuevo. La API devuelve ambos valores para hacer visible esa diferencia; en un servicio real no expondremos configuración indiscriminadamente para depurar.

A continuación el runner solicita un rollout restart, espera su final y exige **env-v2**. Esa segunda fase muestra que los containers nuevos sí reciben la entrada actual.

Actualizar un archivo y arrancar nuevos procesos son mecanismos distintos. Si mezclamos sus resultados en una sola captura, sería difícil saber por qué apareció el valor nuevo.

## Cambiar configuración también puede necesitar compatibilidad

Una variable que cambia el formato de un dato o la ubicación de una dependencia puede requerir una transición tan cuidadosa como un cambio de código. Que no haya una image nueva no reduce automáticamente el riesgo.

Conviene definir valores obligatorios, tipos y tratamiento de errores. El parser del laboratorio exige un mensaje no vacío y flags booleanos; no convierte el string `"false"` en una señal válida por ser truthy en JavaScript.

Para una configuración grande también hay que decidir si cada cambio se aplica como una versión coherente, cuándo se recarga y qué ocurre si falla su validación. Leer archivos continuamente puede ser suficiente para este ejemplo pequeño, pero no es un patrón universal de recarga.

Si necesitas recuperar exactamente una release, debes identificar también su configuración y el procedimiento de actualización. Rollout undo no es una máquina del tiempo sobre todo recurso mutable que la plantilla referencia.

## Código completo y pruebas

El [ConfigMap](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/configmap.json), el [Deployment](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/deployment.json) y el parser están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads test
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

## Garantías y límites

Se prueba archivo actualizado, entorno antiguo y entorno nuevo tras rollout. No se comprueba un montaje subPath, un sistema general de hot reload o cambios concurrentes de múltiples configuraciones. El experimento no fija una latencia de propagación para otros clústeres.

## Ejercicio: una aplicación que cachea la configuración

El archivo cambia, pero el proceso guarda el valor leído al inicio. Decide qué debería observar el operador y cómo diseñarías una recarga validada. Explica qué parte corresponde a Kubernetes y cuál al programa. Continúa con [Secrets y RBAC](/posts/kubernetes-secrets-serviceaccounts-rbac).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [ConfigMaps y formas de consumo](https://kubernetes.io/docs/concepts/configuration/configmap/).
- [Actualizar configuración de un Pod](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/).
- [ConfigMap como volumen](https://kubernetes.io/docs/concepts/storage/volumes/#configmap).
