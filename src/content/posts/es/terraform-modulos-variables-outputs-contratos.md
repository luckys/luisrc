---
id: "TF-MODULES"
title: "Módulos de Terraform: agrupar una decisión con variables y outputs claros"
published: "2026-10-25T15:03:00Z"
locale: "es"
translationKey: "terraform-series-tf-modules"
slug: "terraform-modulos-variables-outputs-contratos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["TF-STATE"]
description: "Cómo separar un módulo útil sin construir una plataforma genérica. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

Una carpeta de Terraform ha crecido hasta mezclar redes, aplicación, datos y docenas de opciones que nadie se atreve a cambiar. Separarla en archivos puede facilitar leerla, pero no crea por sí sola límites ni un contrato entre esas decisiones.

Un **módulo** agrupa recursos y expresa entradas y salidas. Después de [state y backend](/posts/terraform-state-backend-locking-secretos), vamos a construir un límite pequeño alrededor del catálogo, sin convertir un laboratorio en una plataforma configurable para cualquier aplicación.

## El root module coordina; el módulo hijo agrupa una decisión

El directorio desde el que ejecutamos Terraform es el **root module**. En este ejemplo crea el namespace y decide qué image, mensaje y revisión de configuración recibe el servicio.

El módulo hijo `modules/catalogue` agrupa los objetos que necesita nuestra API: configuración, fixture de Secret, Deployment, Service e Ingress. No aprovisiona el clúster K3s ni una red cloud. Esa frontera permite revisar el servicio sin fingir que el módulo es capaz de operar toda la plataforma.

El root lo utiliza así, en `terraform/main.tf`:

```hcl
module "catalogue" {
  source          = "./modules/catalogue"
  namespace       = kubernetes_namespace_v1.lab.metadata[0].name
  image           = var.image
  message         = var.message
  config_revision = var.config_revision
}
```

`source` apunta a código local del checkout. Las variables conectan decisiones del root con el módulo. El nombre `catalogue` de este bloque aparece en las direcciones del state, como `module.catalogue.kubernetes_service_v1.api`.

La referencia `kubernetes_namespace_v1.lab.metadata[0].name` expresa una dependencia con un recurso gestionado. Es más precisa que escribir el mismo nombre a mano y confiar en que el orden de los archivos haga el resto. Terraform puede analizar la referencia para ordenar operaciones relacionadas.

<img src="/assets/visuals/terraform/TF-MODULES.svg" alt="El root module conecta namespace e inputs con el módulo del catálogo. Sus recursos comparten el state del root y ofrecen outputs concretos, sin crear una frontera automática de permisos o almacenamiento." width="296" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/TF-MODULES.svg).

## Una variable útil permite una elección que sabemos soportar

El módulo permite elegir `config_revision`, pero el ejercicio solo implementa dos valores:

```hcl
variable "config_revision" {
  type = string
  validation {
    condition     = contains(["v1", "v2"], var.config_revision)
    error_message = "This laboratory only implements config revisions v1 and v2."
  }
}
```

La validación evita una entrada que este laboratorio no sabe utilizar. No demuestra que una revisión esté desplegada o sea saludable. También hace explícito que el módulo no es un catálogo general de versiones.

`image` permite recibir la referencia de la image importada en el runtime local. `message` es una configuración no sensible. `namespace` indica el ámbito donde se crearán los objetos. Son entradas que usa este servicio, no una lista de todas las propiedades posibles de Kubernetes.

Podríamos añadir variables para cada label, probe, puerto, modo de red y política imaginable. El coste sería trasladar al consumidor casi todos los detalles internos y multiplicar las combinaciones que tendríamos que probar.

Preferimos exponer decisiones que el caso necesita. Cuando aparezca una segunda necesidad real, revisaremos si conviene ampliar el módulo o crear otro. Escribir un módulo no obliga a hacerlo universal ni a publicarlo en un registry.

## Los outputs ofrecen resultados sin exponer toda la implementación

El módulo devuelve el nombre del Service como `service_name`. El root puede utilizarlo mediante `module.catalogue.service_name` sin conocer cómo se llama el bloque interno que creó ese objeto.

Un output debería tener un consumidor o una utilidad de operación. Exportar todos los atributos internos por defecto hace que cambios pequeños se conviertan en cambios del contrato. Exportar credenciales añade además un riesgo de exposición.

En el laboratorio no devolvemos la fixture de Secret ni el kubeconfig como outputs públicos. La prueba de que la aplicación recibe configuración consiste en una condición booleana y una respuesta esperada, no en copiar el contenido sensible a una salida cómoda.

Un nombre de Service tampoco demuestra que su backend esté disponible. El output es un resultado de configuración; la petición HTTP atraviesa otro conjunto de componentes y necesita su propia prueba.

## Módulo, provider y state no son fronteras equivalentes

Un módulo hijo tiene su código y su contrato, pero no obtiene automáticamente un state aislado. En nuestro root, sus recursos aparecen dentro del mismo state con el prefijo del módulo. Separar la carpeta no separa quién puede leer ese archivo ni qué operación los modifica.

El módulo declara el requisito del provider, mientras que el root configura la conexión al clúster. Eso evita ocultar dentro del módulo una selección inesperada de entorno o credenciales.

Si necesitásemos gestionar dos clústeres habría que diseñar las configuraciones de provider y cómo se pasan a cada módulo. No basta con duplicar un nombre de variable para tener aislamiento entre entornos.

Mover recursos ya gestionados a un módulo también cambia sus direcciones. Hay mecanismos como los bloques `moved` para describir ciertos cambios de dirección sin recrear objetos. Hay que revisar el plan: un refactor de archivos no debería convertirse accidentalmente en la destrucción de una base de datos. Aquí partimos de un entorno vacío y no ensayamos esa migración.

## Código completo y pruebas

El [root module](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/terraform/main.tf) y el [módulo del catálogo](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/terraform/modules/catalogue/main.tf) están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/declarative-infrastructure test
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

El recorrido inicializa el módulo local, valida HCL y opera sus objetos con un provider real. No sustituye esa integración por un test que solo busque nombres de variables en un archivo.

## Garantías y límites

Se prueba una composición de módulo local y un servicio concreto. No hay módulo remoto publicado, compatibilidad entre versiones del módulo, varios clústeres o migración de direcciones probada. La fixture no representa un sistema de gestión de secretos de producción.

## Ejercicio: justificar una variable nueva

Propón cambiar el puerto del catálogo. Explica qué objetos necesitan conocerlo, qué quedaría fijo y qué prueba debería fallar si una referencia se queda con el puerto antiguo. Decide después si el módulo debe exponer esa elección. Continúa con [drift y refresh](/posts/terraform-drift-refresh-reconciliar-cambios).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Desarrollo de módulos](https://developer.hashicorp.com/terraform/language/modules/develop).
- [Referencias a valores](https://developer.hashicorp.com/terraform/language/expressions/references).
- [Providers dentro de módulos](https://developer.hashicorp.com/terraform/language/modules/develop/providers).
- [Refactor de direcciones con moved](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring).
