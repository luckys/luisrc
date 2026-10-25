---
id: "P065"
title: "Terraform: describir infraestructura, revisar el plan y comprobar el resultado"
published: "2026-10-25T15:00:00Z"
locale: "es"
translationKey: "terraform-series-p065"
slug: "terraform-configuracion-plan-apply-infraestructura"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P062", "P063", "P064"]
description: "Cómo separar configuración, plan, state y comportamiento observado. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

El servicio funciona, pero nadie sabe reproducir cómo se configuraron su red, sus recursos y su entrada HTTP. La consola muestra el resultado de varias sesiones manuales; el repositorio solo contiene el código de la aplicación.

**Terraform** permite describir recursos y revisar los cambios necesarios para acercarlos a esa configuración. Después de [elegir recursos cloud](/posts/cloud-iaas-paas-serverless-responsabilidad) y [separar despliegue de validación](/posts/ci-cd-pipeline-gates-evidencia), necesitamos distinguir lo que pedimos, lo que Terraform propone y lo que realmente atiende al usuario.

Esta ruta se centra en Terraform. Usaremos Kubernetes como API real de infraestructura, con un clúster **K3s** local. Los objetos y controladores de Kubernetes tendrán su propio bloque de artículos; aquí bastará con identificar qué papel desempeña cada uno.

## La configuración describe recursos, no una secuencia de clics

En **HCL**, el lenguaje de configuración de Terraform, un bloque `resource` declara un objeto que gestionará un provider. La dirección del bloque identifica ese recurso en la configuración y en el state; no es necesariamente el nombre que tendrá en el sistema remoto.

Nuestro root module crea un namespace, un ámbito con nombre para los objetos del ejercicio:

```hcl
resource "kubernetes_namespace_v1" "lab" {
  metadata {
    name   = var.namespace
    labels = { "luisrc-lab" = "declarative-infrastructure" }
  }
}
```

`kubernetes_namespace_v1.lab` es la dirección Terraform. `var.namespace` contiene el nombre concreto que enviamos a Kubernetes, generado para cada ejecución. La etiqueta permite reconocer el ámbito del laboratorio; por sí sola no implementa permisos o aislamiento de red.

El resto se agrupa en un módulo: ConfigMap, Secret ficticio, Deployment, Service e Ingress. En conjunto son **seis recursos gestionados por Terraform**. Los Pods que el Deployment crea no son seis recursos adicionales en nuestro state: los mantiene Kubernetes.

Una referencia al nombre del namespace expresa una dependencia entre recursos. Terraform construye un grafo para ordenar las operaciones que lo requieren. Repartir bloques en varios archivos no define ese orden; los archivos del directorio forman parte del mismo módulo.

<img src="/assets/visuals/terraform/P065.svg" alt="La configuración HCL define el objetivo; un plan propone acciones y apply las ejecuta mediante el provider sobre Kubernetes. La prueba HTTP verifica después el resultado que recibe la aplicación." width="303" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/P065.svg).

## Init, validate, plan y apply responden a preguntas distintas

**Init** prepara el directorio de trabajo, backend y providers necesarios. **Validate** comprueba la coherencia de la configuración con sus esquemas disponibles. Que valide no demuestra que existan permisos, capacidad o conectividad para crear los recursos.

**Plan** consulta el estado conocido y los objetos gestionados, compara con la configuración y propone acciones. El plan puede incluir creaciones, actualizaciones y reemplazos que también implican borrados. Conviene leer sus direcciones y atributos, no solo el número final.

**Apply** ejecuta operaciones del plan mediante los providers. El laboratorio guarda el plan para aplicar ese archivo, en lugar de revisar una propuesta y recalcular otra silenciosamente justo antes de ejecutarla.

Dentro del container Terraform, el harness realiza operaciones equivalentes a estas sobre su directorio privado:

```bash
terraform init -input=false -lockfile=readonly
terraform fmt -check -recursive
terraform validate
terraform plan -detailed-exitcode -out=create.plan
terraform apply create.plan
```

Con `-detailed-exitcode`, un plan sin cambios devuelve `0`; uno con cambios devuelve `2`; un error devuelve `1`. El código `2` no es una prueba fallida de Terraform. El runner debe distinguirlo de los errores reales.

## Un apply correcto todavía necesita una prueba del servicio

Después de aplicar, esperamos el rollout del Deployment y consultamos `/catalogue` mediante el Ingress **Traefik**. La respuesta tiene que ser `200` y contener el mensaje de configuración esperado. Eso comprueba un recorrido HTTP, no únicamente que el API de Kubernetes haya aceptado objetos.

Durante el primer arranque del laboratorio, el nodo alcanzó `Ready` antes de existir el Deployment de Traefik. Intentar esperar su rollout en ese instante devolvió `NotFound`. Se corrigió la espera: el controlador de entrada debe existir y estar disponible. La salud del nodo no sustituye la preparación de todos los componentes.

El servidor lee un archivo de ConfigMap y recibe una fixture pública mediante un Secret. No hay catálogo de producción ni credenciales reales. La aplicación informa de que la configuración está presente, sin devolver el valor del Secret.

## Terraform y Kubernetes tienen ciclos de reconciliación diferentes

Borramos un Pod del servicio y esperamos otro con un UID distinto. Kubernetes lo repone mediante sus controladores. Después, un nuevo plan Terraform sigue sin cambios: el Deployment declarado conserva su estado deseado.

Terraform no se queda ejecutándose para vigilar cada Pod después de apply. Un futuro plan vuelve a observar los recursos de su ámbito. Kubernetes, mientras tanto, mantiene sus propios controladores activos.

Esta diferencia explica por qué utilizar ambas herramientas no es duplicar necesariamente el mismo trabajo. Sí aparece un conflicto si dos gestores intentan imponer continuamente valores diferentes sobre el mismo campo. Antes de automatizar cambios conviene asignar su propiedad.

## Código completo y pruebas

Clona el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git). Las [fuentes del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/README.md) explican los requisitos y la limpieza:

```bash
pnpm install --frozen-lockfile
pnpm --dir packages/declarative-infrastructure test
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

Necesitas Docker con soporte para el container privilegiado de K3s y acceso inicial a images y provider. Terraform y kubectl se ejecutan en containers; no se instalan binarios en el host. El harness crea un clúster propio, aplica y destruye su namespace y elimina ese clúster. No apunta a tu kubeconfig habitual.

## Garantías y límites

El ejercicio comprueba recursos y HTTP locales, no una plataforma de producción. Un único nodo no prueba alta disponibilidad. Tampoco acredita capacidad, autoscaling, TLS o locking remoto. El [bloque Kubernetes](/posts/kubernetes-pods-api-controladores) completa los experimentos de P065; este recorrido de Terraform conserva los límites indicados.

## Ejercicio: leer un plan antes de contar sus cambios

Elige una creación y una actualización de la captura. Identifica dirección, objeto remoto y responsable del cambio. Explica por qué un `apply` correcto y un HTTP `200` son evidencias distintas. Continúa con [providers y lockfile](/posts/terraform-providers-versiones-lockfile).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan).
- [Terraform apply](https://developer.hashicorp.com/terraform/cli/commands/apply).
- [Referencias y dependencias](https://developer.hashicorp.com/terraform/language/expressions/references).
- [Deployment de Kubernetes](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).
