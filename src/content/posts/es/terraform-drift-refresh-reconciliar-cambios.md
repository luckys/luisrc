---
id: "TF-DRIFT"
title: "Drift en Terraform: detectar un cambio manual y decidir qué conservar"
published: "2026-10-25T15:04:00Z"
locale: "es"
translationKey: "terraform-series-tf-drift"
slug: "terraform-drift-refresh-reconciliar-cambios"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["TF-MODULES"]
description: "Cómo distinguir observar cambios, aceptarlos en state y reparar el recurso. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

Alguien corrige un valor directamente en el clúster para resolver una incidencia. El servicio vuelve a responder, pero la configuración del repositorio sigue describiendo el valor anterior. El siguiente apply podría deshacer esa corrección sin que nadie la recuerde.

Ese desajuste es un caso de **drift**. Después de [organizar el módulo](/posts/terraform-modulos-variables-outputs-contratos), necesitamos distinguir tres acciones: observar el cambio real, actualizar el state y decidir qué configuración queremos conservar.

## La fuente declarada y el objeto real pueden separarse

El ConfigMap del catálogo tiene un mensaje declarado:

```hcl
resource "kubernetes_config_map_v1" "settings" {
  metadata {
    name      = "${local.name}-${var.config_revision}"
    namespace = var.namespace
    labels    = local.labels
  }
  data = { message = var.message }
  lifecycle { create_before_destroy = true }
}
```

El servidor lee el archivo proyectado desde ese ConfigMap en cada petición. El harness modifica `data.message` a `manual-drift` mediante el API de Kubernetes, fuera de Terraform, y espera hasta que HTTP devuelve ese mensaje.

La proyección del volumen puede tardar en actualizarse. No inferimos el estado de la aplicación de una respuesta correcta del comando `patch`; esperamos el resultado HTTP. La prueba local tampoco garantiza cuánto tardaría en otro clúster.

El repositorio no ha cambiado. Un plan ordinario vuelve a observar el recurso y propone actualizarlo para recuperar el mensaje declarado. El valor que existe ahora no se convierte automáticamente en el nuevo objetivo.

## Un plan permite ver la divergencia antes de repararla

La captura `drift_detected` conserva la respuesta con `manual-drift` y una actualización planificada sobre el ConfigMap. El harness guarda el plan y después lo aplica. La lectura HTTP vuelve al mensaje inicial y un plan posterior queda sin cambios.

El resumen público registra direcciones y tipos de acción. No publica todos los valores `before` y `after`: en otros recursos pueden contener secretos. Para revisar una operación real, la persona autorizada sí necesita consultar los detalles pertinentes del plan en un entorno protegido.

Que una diferencia sea detectada no indica que debamos revertirla. Antes hay que saber por qué se hizo. Si la corrección manual era necesaria, el trabajo puede consistir en incorporarla al código y revisar un plan nuevo. El comando no conoce la intención de quien estaba atendiendo la incidencia.

<img src="/assets/visuals/terraform/TF-DRIFT.svg" alt="Un cambio manual produce drift. Refresh-only acepta observaciones en state y mantiene el mensaje real. Un plan ordinario sigue comparando con HCL; aplicar el objetivo declarado y consultar HTTP comprueba la reparación." width="295" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/TF-DRIFT.svg).

## Refresh-only acepta observaciones en state, no repara el recurso

Más adelante provocamos otro cambio manual, esta vez a `refresh-only-drift`. Ejecutamos un plan **refresh-only** y aplicamos ese archivo:

```bash
terraform plan -refresh-only -out=refresh-only.plan
terraform apply refresh-only.plan
```

Ese modo actualiza la información de state y outputs según lo observado; no pretende modificar los recursos remotos para que coincidan con la configuración. La aplicación sigue respondiendo con el mensaje manual después de aplicarlo.

El harness hace entonces un plan ordinario. Sigue proponiendo una actualización, porque el código aún describe `new-revision`, no `refresh-only-drift`. Aplicar ese segundo plan es lo que recupera el valor declarado.

Esta secuencia evita un error habitual: interpretar «state actualizado» como «infraestructura corregida». También muestra por qué aceptar información nueva en el state no equivale a editar el objetivo del repositorio.

El comando histórico `terraform refresh` no es nuestro flujo. Utilizamos el modo plan/apply refresh-only para poder revisar qué se va a aceptar, tal como recomienda la documentación actual.

## Reconciliar exige decidir quién manda sobre cada campo

No todo cambio que haga otro controlador es un accidente. Un autoscaler puede tener la responsabilidad de ajustar réplicas. Si Terraform también intenta restablecer un número fijo en cada apply, ambos gestores pueden contradecirse.

Opciones como `ignore_changes` permiten delegar ciertos atributos durante actualizaciones, con límites. No conviene usarlas como una forma de silenciar cualquier diferencia desconocida: perderíamos precisamente la señal que queríamos revisar.

Nuestro experimento de borrar un Pod muestra otro caso. El Deployment conserva su configuración; Kubernetes repone una instancia de ejecución. El siguiente plan Terraform no necesita modificar el Deployment. No todos los cambios del clúster son cambios sobre recursos o atributos que este root gestiona.

Para un incidente real anotaría objeto, campo, motivo, autor y seguimiento de la corrección. Después elegiría entre volver al objetivo anterior o convertir el arreglo en la nueva configuración revisada. Dejar esa decisión implícita la aplaza hasta el siguiente despliegue.

## Código completo y pruebas

El [harness de drift](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/scripts/exercise.mjs) y el [resumen de planes](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/scripts/plan.mjs) viven en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

El visor del [último artículo de esta ruta](/posts/terraform-planes-guardados-reemplazos-recuperacion) permite seleccionar las fases y comparar las acciones propuestas con el mensaje HTTP archivado. No vuelve a ejecutar patch o apply desde el navegador.

## Garantías y límites

Se prueban cambios de ConfigMap, observación HTTP, refresh-only y reparación sobre un clúster propio. No se prueban cambios concurrentes entre operadores, drift de todos los tipos de recurso o políticas de una organización. Un plan solo puede observar lo que su configuración, provider y permisos le permiten conocer.

## Ejercicio: conservar una corrección de emergencia

El cambio manual solucionó un fallo y debe mantenerse. Describe qué editarías en código y qué esperas que proponga el siguiente plan. Después explica por qué un refresh-only aislado no basta para que el próximo apply ordinario conserve esa intención. Continúa con [planes guardados y reemplazos](/posts/terraform-planes-guardados-reemplazos-recuperacion).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Modos de planificación](https://developer.hashicorp.com/terraform/cli/commands/plan).
- [Refresh y alternativa refresh-only](https://developer.hashicorp.com/terraform/cli/commands/refresh).
- [Lifecycle e ignore_changes](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle).
- [ConfigMaps y actualización de volúmenes](https://kubernetes.io/docs/concepts/configuration/configmap/).
