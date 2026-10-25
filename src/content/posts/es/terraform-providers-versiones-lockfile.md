---
id: "TF-PROVIDERS"
title: "Providers de Terraform: fijar versiones y saber qué valida cada herramienta"
published: "2026-10-25T15:01:00Z"
locale: "es"
translationKey: "terraform-series-tf-providers"
slug: "terraform-providers-versiones-lockfile"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P065"]
description: "Qué aporta el provider y qué garantizan las restricciones y el lockfile. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

El mismo archivo Terraform que funcionaba ayer propone hoy un cambio diferente después de inicializar el proyecto. El código HCL no ha cambiado, pero sí puede haber cambiado el plugin que interpreta y gestiona sus recursos.

Los **providers** son dependencias del proyecto de infraestructura. Tras [el recorrido de plan y apply](/posts/terraform-configuracion-plan-apply-infraestructura), vamos a fijar qué versiones usamos y a separar validación de sintaxis, esquema y comportamiento real.

## Terraform Core y provider tienen responsabilidades distintas

**Terraform Core** evalúa configuración, grafo, planes y state. Un provider aporta esquemas y operaciones para hablar con una API, como AWS o Kubernetes. El provider no contiene el clúster: es el cliente con el que Terraform gestiona sus objetos.

Un recurso `kubernetes_deployment_v1` existe porque el provider conoce su esquema y operaciones. La versión del provider puede cambiar atributos admitidos, comportamiento de actualización o interpretación del estado. Por eso actualizarlo merece revisar su changelog y el plan resultante.

En el laboratorio fijamos **Terraform 1.15.3** y **hashicorp/kubernetes 3.4.0**. Son versiones elegidas para reproducir este ejercicio, no una recomendación de mantenerlas indefinidamente ni una afirmación de que sean siempre las últimas.

## Source, versión y configuración no son lo mismo

Este es `terraform/versions.tf`:

```hcl
terraform {
  required_version = "= 1.15.3"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 3.4.0"
    }
  }
  backend "local" {}
}

provider "kubernetes" {
  config_path = "/work/kubeconfig"
}
```

`source` identifica el provider en su registro. `version` limita qué versión puede seleccionarse. El nombre local `kubernetes` conecta esa declaración con los recursos y su bloque de configuración.

El bloque `provider` indica cómo acceder al clúster. `/work/kubeconfig` apunta a una copia privada creada para esta ejecución local, no al fichero personal del usuario. Ese archivo incluye credenciales de administración del clúster efímero y no se publica.

El backend local determina dónde se guarda el state. No es otro provider y no elige la versión del plugin. Tener todos estos bloques cerca en un archivo no los convierte en el mismo mecanismo.

<img src="/assets/visuals/terraform/TF-PROVIDERS.svg" alt="Terraform Core utiliza el provider seleccionado por source y versión. Init verifica su selección y hashes del lockfile antes de operar una API Kubernetes que requiere permisos y conectividad propios." width="309" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/TF-PROVIDERS.svg).

## El lockfile registra la selección y checksums del provider

La restricción define el conjunto permitido. **`.terraform.lock.hcl`** registra la selección de providers y hashes utilizados para verificar paquetes. Se conserva en el repositorio y el ejercicio usa `init -lockfile=readonly` para impedir que una ejecución ordinaria lo reescriba silenciosamente.

No conviene sustituir el lockfile por «hoy el registro entrega esta versión». Tampoco hay que interpretar un checksum como una auditoría del código del provider. La verificación de procedencia e integridad y la evaluación de sus permisos y comportamiento son preguntas diferentes.

El lockfile no fija por sí solo todas las entradas del proyecto. Los módulos remotos requieren sus propias restricciones o referencias apropiadas. La image que ejecuta la CLI y la versión del API remoto también importan. Aquí el módulo es local y forma parte del checkout; las images Terraform y K3s están fijadas por digest en `tools.json`.

El proyecto sigue teniendo un único lockfile pnpm para sus paquetes JavaScript. El lockfile de Terraform controla otra clase de dependencia; no es una segunda instalación Node dentro del laboratorio.

## Fmt, validate y plan detectan fallos diferentes

**Fmt** normaliza el formato HCL. Su check facilita revisar cambios sin ruido de estilo, pero no demuestra que un recurso pueda crearse.

**Validate** comprueba la configuración con los esquemas preparados. Puede detectar referencias o tipos incompatibles. Sigue sin ser una prueba de conectividad, permisos de la sesión o recursos disponibles.

**Plan** incorpora observaciones de los recursos mediante el provider y propone cambios. Aun así, entre plan y apply pueden cambiar permisos, capacidad o estado externo. Es necesaria una comprobación posterior del resultado.

En la captura, `initialized_validated` conserva la versión real reportada por Terraform, la selección del provider, el éxito de fmt/validate y el uso del lockfile readonly. Las llamadas HTTP posteriores son una evidencia adicional, no una conclusión extraída de validate.

## Actualizar una dependencia es un cambio revisable

Para actualizar el provider abriría un cambio explícito: nueva restricción si corresponde, nueva selección del lockfile, notas de migración y un plan revisado contra un entorno de pruebas. No ejecutaría un upgrade automático como paso oculto de cada despliegue.

Esto tampoco significa congelar dependencias para siempre. Una corrección de seguridad o compatibilidad puede justificar una actualización. El objetivo es poder identificar cuándo cambió esa entrada y qué comprobación respalda el cambio.

Una versión fijada puede reproducir un defecto. Si una API remota cambia, la combinación antigua también puede dejar de servir. La reproducibilidad ayuda a diagnosticar y revisar decisiones; no evita el mantenimiento.

## Código completo y pruebas

El [lockfile y configuración](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/terraform/versions.tf) y [las herramientas fijadas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/tools.json) están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

`exercise` inicializa el provider y opera contra K3s real. `verify` contrasta la captura y fuentes archivadas sin volver a consultar el registro o iniciar Docker.

## Garantías y límites

Se comprueban las versiones, el lockfile utilizado y el recorrido local. No se ha ejecutado una migración entre versiones de providers, una auditoría de su implementación o un test contra varios sistemas operativos. Los digests y hashes no demuestran esas propiedades.

## Ejercicio: encontrar una entrada que no fija el lockfile

Lista CLI, provider, módulo, image de aplicación y API Kubernetes. Indica cómo se identifica cada versión en el laboratorio y cuál necesitarías revisar al cambiarla. Continúa con [state y backend](/posts/terraform-state-backend-locking-secretos).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Provider requirements](https://developer.hashicorp.com/terraform/language/providers/requirements).
- [Dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock).
- [Provider Kubernetes](https://registry.terraform.io/providers/hashicorp/kubernetes/latest/docs).
- [Terraform validate](https://developer.hashicorp.com/terraform/cli/commands/validate).
