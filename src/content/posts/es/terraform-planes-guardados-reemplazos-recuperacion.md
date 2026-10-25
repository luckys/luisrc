---
id: "TF-CHANGES"
title: "Planes guardados y reemplazos: aplicar el cambio revisado sin prometer un rollback automático"
published: "2026-10-25T15:05:00Z"
locale: "es"
translationKey: "terraform-series-tf-changes"
slug: "terraform-planes-guardados-reemplazos-recuperacion"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["TF-DRIFT"]
description: "Cómo revisar reemplazos, rechazar planes obsoletos y recuperar después de un fallo. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

Se revisa un plan, pasan unos minutos y otra operación actualiza el mismo state. Aplicar sin comprobar esa relación puede significar ejecutar una decisión calculada sobre un punto de partida que ya no existe.

Los **planes guardados** permiten conservar una propuesta concreta. Después de [observar y reparar drift](/posts/terraform-drift-refresh-reconciliar-cambios), vamos a comprobar un plan obsoleto, revisar un reemplazo y separar recuperación de una supuesta transacción que deshace todo automáticamente.

## Un archivo de plan conserva una propuesta y su contexto

El flujo del laboratorio guarda cada plan con `-out` y aplica ese archivo. Así no se limita a imprimir una propuesta para luego ejecutar un apply que calcule otra distinta.

La revisión debe vincular configuración, variables, versiones de herramientas, state y archivo de plan. Guardar `create.plan` con un nombre reconocible no acredita por sí solo su procedencia ni que no haya sido sustituido.

El archivo también puede contener valores sensibles. El visor público recibe un resumen de direcciones y acciones, no el plan completo ni el JSON íntegro producido por `terraform show -json`.

El resumen del laboratorio elimina los valores antes de construir la evidencia:

```javascript
  const changes = (plan.resource_changes ?? []).filter((r) => r.change.actions.some((a) => a !== 'no-op' && a !== 'read'))
    .map((r) => ({ address: r.address, actions: r.change.actions })).sort((a, b) => a.address.localeCompare(b.address))
```

Eso mantiene visibles las operaciones que queremos explicar. No convierte el resumen en una revisión exhaustiva del contenido: alguien autorizado debe inspeccionar los atributos relevantes antes de aprobar un cambio real.

<img src="/assets/visuals/terraform/TF-CHANGES.svg" alt="Un plan guardado puede quedar obsoleto cuando otro apply avanza el state. En un experimento distinto se revisa un reemplazo de ConfigMap con creación y borrado y se valida su resultado HTTP sin prometer rollback global." width="294" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/TF-CHANGES.svg).

## Un state nuevo puede invalidar el plan guardado

El harness calcula una actualización con el mensaje `saved-plan-a` y no la aplica. Después calcula y aplica otro plan con `new-state-b`. El state avanza con esa segunda operación.

Al intentar aplicar el archivo anterior, Terraform devuelve **Saved plan is stale**. La prueba exige ese rechazo y comprueba que HTTP conserva `new-state-b`; no acepta cualquier fallo como prueba de obsolescencia.

Ese control evita aplicar un plan contra un state incompatible. No significa que todos los cambios externos queden bloqueados mientras esperamos una aprobación. Un operador puede modificar el recurso remoto sin escribir nuestro state. Antes de ejecutar cambios importantes sigue haciendo falta valorar la antigüedad de la propuesta y la política de revisión.

El bloqueo de state tampoco mantiene una transacción abierta durante toda una revisión humana. Cada mecanismo tiene su ámbito; no deberíamos concluir que la infraestructura queda congelada desde que alguien genera un archivo de plan.

## Un reemplazo incluye creación y borrado

En nuestro módulo el nombre del ConfigMap contiene `config_revision`. Pasar de `v1` a `v2` modifica un atributo que obliga a reemplazar ese objeto. El plan observado incluye `create` y `delete` para ese recurso, además de una actualización del Deployment que lo referencia.

El ConfigMap declara `create_before_destroy = true`. El nombre nuevo puede coexistir con el anterior, por lo que el ejemplo permite crear primero la nueva configuración. El Deployment cambia su referencia y el harness espera el rollout y la respuesta esperada antes de dar por validado el resultado completo.

El flag no promete disponibilidad continua. No elimina cuotas, restricciones de nombres, incompatibilidad del dato o problemas en dependencias. Para un recurso con un nombre único no sería válido asumir que ambas versiones pueden existir simultáneamente.

La captura confirma la ausencia del ConfigMap anterior después de aplicar. No hemos sustituido una base de datos ni migrado su contenido. Extrapolar este reemplazo sin estado de negocio a un almacenamiento persistente sería una conclusión peligrosa.

## Apply no es una transacción global con rollback automático

Terraform puede completar varias operaciones y fallar en otra. El sistema puede quedar parcialmente cambiado. La recuperación requiere inspeccionar lo ocurrido, el state y el plan siguiente; no asumir que todo volvió al punto inicial.

Reaplicar una configuración anterior genera nuevas operaciones sobre el estado actual. No recupera por sí solo datos borrados ni revierte efectos externos. Opciones como `prevent_destroy` pueden proteger ciertos recorridos, pero no reemplazan permisos adecuados, backups o procedimientos de recuperación.

En este laboratorio la política local rechaza direcciones ajenas y el borrado del namespace fuera del teardown explícito. El destroy final genera un plan de seis borrados, comprueba su alcance y después confirma que el namespace y los recursos del state ya no existen.

No se utilizan `prune` o borrados globales para limpiar. El clúster y su red se identifican mediante el nombre único y la propiedad de la ejecución.

## Comparar propuestas sin convertir tiempos en benchmarks

El gráfico cuenta acciones de planes archivados. Un reemplazo suma creación y borrado sobre el mismo recurso; por eso las barras no equivalen al número de objetos distintos.

<img src="/assets/interactive/declarative-infrastructure/plan-actions.svg" alt="Cuatro planes locales comparan seis creaciones iniciales, una actualización por drift, un reemplazo con creación y borrado más una actualización, y seis borrados finales. Son acciones declaradas en planes, no tiempos o disponibilidad." width="380" height="470" loading="lazy" style="width:100%;height:auto" />

[Ampliar el gráfico](/assets/interactive/declarative-infrastructure/plan-actions.svg).

El visor permite seguir las fases reales, sus planes y las respuestas HTTP. Una fase sin petición HTTP muestra «No capturado». No hereda una respuesta anterior para aparentar continuidad.

<iframe src="/assets/interactive/declarative-infrastructure/explorer.html" title="Recorrido observado de Terraform y Kubernetes local" loading="lazy" width="100%" height="1200" style="border:0;border-radius:12px"></iframe>

[Abrir el visor](/assets/interactive/declarative-infrastructure/explorer.html).

## Código completo y pruebas

Las [fuentes y comandos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/README.md) y el [harness](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/scripts/exercise.mjs) están en el [repositorio](https://github.com/luckys/luisrc-blog-examples.git).

```bash
pnpm --dir packages/declarative-infrastructure test
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

## Garantías y límites

Se observan un plan obsoleto rechazado, reemplazo de configuración, respuestas HTTP y teardown local. No hay fallo inyectado a mitad de apply, recuperación de datos, HA o disponibilidad continua probados. Los tiempos de fases pertenecen a este recorrido, no son benchmarks de Terraform o Kubernetes.

## Ejercicio: revisar un reemplazo con datos

Sustituye mentalmente el ConfigMap por una base de datos. Identifica qué preguntas nuevas aparecen antes de aceptar creación y borrado: contenido, conexiones, compatibilidad, copia, validación y vuelta atrás. No ejecutes ese cambio en el laboratorio. Continúa con [Pods y controladores](/posts/kubernetes-pods-api-controladores) y sus experimentos específicos de Kubernetes.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Guardar planes y planificación](https://developer.hashicorp.com/terraform/cli/commands/plan).
- [Apply de un plan guardado](https://developer.hashicorp.com/terraform/cli/commands/apply).
- [Lifecycle y create_before_destroy](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle).
- [State locking](https://developer.hashicorp.com/terraform/language/state/locking).
