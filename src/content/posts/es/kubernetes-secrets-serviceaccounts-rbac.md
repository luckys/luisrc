---
id: "K8S-SECRETS"
title: "Secrets y RBAC: codificar un valor no decide quién puede leerlo"
published: "2026-10-25T16:08:00Z"
locale: "es"
translationKey: "kubernetes-series-k8s-secrets"
slug: "kubernetes-secrets-serviceaccounts-rbac"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["K8S-CONFIG"]
description: "Cómo separar Secret, identidad de workload y autorización del API. Ejemplos y observaciones verificables en Kubernetes local."
author: "Luis Ramírez Calle"
series: "Kubernetes: ejecutar, observar y recuperar un servicio"
tags: ["kubernetes", "containers", "backend", "devops"]
---

El valor está en un objeto Secret y aparece codificado en base64. Eso no impide que una identidad con permiso de lectura lo recupere. Tampoco significa que el almacenamiento del clúster esté cifrado o que cualquier Pod deba poder consultar todos los secretos.

Después de [ConfigMaps](/posts/kubernetes-configmaps-env-volumenes), vamos a separar tres decisiones: cómo se entrega un valor, qué identidad usa un workload y qué operaciones autoriza el API de Kubernetes.

## Un Secret tiene tratamiento específico, no seguridad automática

Un **Secret** es un objeto para valores que requieren un tratamiento diferente de la configuración ordinaria. Puede entregarse a containers mediante referencias o volúmenes. Su seguridad depende también de acceso al API, almacenamiento, nodos y permisos de quienes ejecutan cargas.

**Base64 es una codificación reversible**, no cifrado. El laboratorio recupera la representación del Secret y comprueba en memoria que decodifica a su fixture pública conocida. Publica únicamente el resultado booleano de esa comparación.

No utilizamos una contraseña real. El manifiesto contiene un valor ficticio explícito para poder repetir la prueba sin acceso a un gestor de secretos. Eso no convierte guardar credenciales reales en Git en una práctica apropiada.

## ServiceAccount identifica una carga frente al API

Una **ServiceAccount** ofrece una identidad para workloads dentro de Kubernetes. La aplicación del catálogo no necesita consultar el API del clúster, así que desactivamos el montaje automático de su token:

```json
{
  "apiVersion": "v1",
  "kind": "ServiceAccount",
  "metadata": {
    "name": "catalogue"
  },
  "automountServiceAccountToken": false
}
```

El Pod también declara `automountServiceAccountToken: false`. Eso evita entregar ese token automático a esta carga; no implementa por sí solo todas las restricciones de red o acceso al nodo.

Consumir un Secret referenciado como variable no requiere dar al código un permiso general para listar Secrets. La entrega del valor y las operaciones que podría hacer una identidad frente al API son caminos distintos.

## Role describe acciones y RoleBinding las asigna

Para el experimento creamos otra ServiceAccount, `reader`, con un **Role** que permite leer un único ConfigMap:

```json
{
  "apiVersion": "rbac.authorization.k8s.io/v1",
  "kind": "Role",
  "metadata": {
    "name": "settings-reader"
  },
  "rules": [
    {
      "apiGroups": [
        ""
      ],
      "resources": [
        "configmaps"
      ],
      "resourceNames": [
        "catalogue-settings"
      ],
      "verbs": [
        "get"
      ]
    }
  ]
}
```

`apiGroups: [""]` se refiere al grupo core. `resources` selecciona ConfigMaps, `resourceNames` acota el objeto y `verbs` permite `get`. No hay wildcard ni permiso de listado de Secrets.

Un **RoleBinding** relaciona ese Role con la ServiceAccount del namespace. Definir el Role sin asignarlo no da permisos a esa identidad. Una **ClusterRole** y una **ClusterRoleBinding** tienen otro alcance que debe revisarse cuando se necesitan.

El objetivo es conceder una operación justificada, no empezar con `cluster-admin` y confiar en que nadie abuse de él.

<img src="/assets/visuals/kubernetes/K8S-SECRETS.svg" alt="Un Role y RoleBinding permiten a reader obtener un ConfigMap concreto. La petición con identidad impersonada para leer Secret se deniega; base64 es una propiedad distinta que no prueba cifrado o rotación." width="312" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kubernetes/K8S-SECRETS.svg).

## La prueba negativa importa tanto como la positiva

El harness administrador realiza peticiones con identidad **impersonada** de `reader`. Leer `catalogue-settings` funciona. Leer `catalogue-dummy`, de tipo Secret, debe fallar con **Forbidden**.

No aceptamos cualquier error como una denegación válida: una desconexión o un nombre mal escrito no acreditan RBAC. El test exige el resultado de autorización esperado.

Esta prueba observa autorización del API con impersonation. No prueba que una aplicación haya obtenido un token real ni su autenticación con él. La diferencia queda registrada en los límites de la captura.

También comprobamos que el Pod de la API mantiene desactivado el automount. El resultado no se deduce solo de una intención en el archivo de ServiceAccount.

## Entregar un secreto no define su rotación

Si un valor llega mediante variable de entorno, un cambio posterior del objeto no modifica el entorno existente del proceso. La aplicación y la operación deben coordinar la nueva credencial, la validez de la anterior y el reemplazo de containers cuando corresponda.

Los volúmenes y gestores externos tienen otros mecanismos, pero siguen necesitando un contrato de recarga. Montar un archivo no obliga a una conexión ya abierta a autenticarse otra vez.

Asimismo, quien puede crear o modificar workloads con acceso a un Secret puede tener vías indirectas para leerlo. Revisar solo el verbo `get secrets` de un usuario no es una evaluación completa de sus capacidades efectivas.

No hemos comprobado cifrado en reposo, auditoría del API o un gestor externo. Esas decisiones se evalúan sobre la plataforma concreta y no se infieren del nombre Secret.

## Código completo y pruebas

El [Role](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/reader-role.json), el [binding](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kubernetes-workloads/manifests/reader-binding.json) y la fixture están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/kubernetes-workloads exercise
pnpm --dir packages/kubernetes-workloads verify
```

La fase `rbac_and_secret` conserva resultados de permiso, identidad y decodificación, sin publicar el contenido del Secret o tokens.

## Garantías y límites

Se observan lectura permitida y lectura prohibida con impersonation y un valor ficticio. No hay autenticación con token real, cifrado en reposo, rotación o aislamiento completo del clúster probados. No se ha concedido al catálogo permiso para administrar Kubernetes.

## Ejercicio: un permiso indirecto

Un usuario no puede leer un Secret, pero puede crear Pods que lo referencien. Explica por qué la primera restricción no basta para proteger el valor y qué capacidades revisarías en conjunto. Continúa con [requests y limits](/posts/kubernetes-requests-limits-scheduling-oom).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/).
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/).
- [ServiceAccounts](https://kubernetes.io/docs/concepts/security/service-accounts/).
- [Buenas prácticas de Secrets](https://kubernetes.io/docs/concepts/security/secrets-good-practices/).
