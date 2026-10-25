---
id: "TF-STATE"
title: "Terraform state: relacionar recursos, coordinar cambios y proteger datos sensibles"
published: "2026-10-25T15:02:00Z"
locale: "es"
translationKey: "terraform-series-tf-state"
slug: "terraform-state-backend-locking-secretos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["TF-PROVIDERS"]
description: "Por qué el state no es un backup ni un archivo para guardar en Git. Ejemplos de infraestructura y evidencia de un laboratorio local."
author: "Luis Ramírez Calle"
series: "Terraform: describir, revisar y reconciliar infraestructura"
tags: ["terraform", "infraestructura", "kubernetes", "devops"]
---

Dos personas aplican cambios desde copias distintas de la misma configuración. Una ha creado el recurso; la otra no sabe que ya está gestionado y calcula su trabajo desde un state diferente. Compartir el código no ha coordinado la operación.

El **Terraform state** relaciona las direcciones declaradas con objetos remotos y conserva información necesaria para gestionarlos. Después de [fijar el provider](/posts/terraform-providers-versiones-lockfile), necesitamos decidir dónde vive ese estado, quién lo utiliza y qué información puede contener.

## El state relaciona identidad declarada e identidad remota

Una dirección como `module.catalogue.kubernetes_service_v1.api` no es la IP del servicio ni el nombre de su Pod. Terraform la asocia con el objeto que gestiona mediante el provider.

La configuración describe lo deseado; el sistema remoto tiene su estado real; el state conserva la relación e información conocida entre ambos. Un plan ordinario puede volver a consultar recursos y detectar diferencias. El archivo no es una observación permanentemente actualizada del clúster.

Si borras el state, no borras los recursos remotos. Pierdes la relación que Terraform estaba utilizando para gestionarlos. Ejecutar apply desde un state vacío no garantiza que descubra y adopte automáticamente todo lo que existe.

**Import** permite asociar objetos existentes con direcciones de Terraform bajo las condiciones del provider. Es una operación que exige configuración y revisión; no equivale a recuperar cualquier state perdido sin analizarlo. Este laboratorio no ensaya importación ni recuperación de un backend averiado.

<img src="/assets/visuals/terraform/TF-STATE.svg" alt="El state relaciona las direcciones de configuración con objetos remotos y atributos conocidos mediante el backend. Los objetos pueden cambiar fuera de Terraform y sus datos necesitan una recuperación separada." width="314" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/terraform/TF-STATE.svg).

## El backend decide dónde se conserva y cómo se coordina

El ejercicio utiliza backend **local** dentro de un directorio privado e ignorado por Git. Es suficiente para una ejecución secuencial y efímera que crea y destruye su propio namespace. No lo presentamos como una solución de colaboración entre varios operadores.

Un backend compartido necesita control de acceso, protección del almacenamiento, historial y recuperación. El **state locking**, cuando está soportado y configurado, evita que operaciones incompatibles escriban simultáneamente el mismo state. No bloquea a una persona que cambie recursos directamente desde otra herramienta.

Desactivar locking para saltarse una espera puede permitir escrituras concurrentes. Antes de forzar un desbloqueo hay que verificar si la operación propietaria sigue activa. Un fichero antiguo o una espera larga, por sí solos, no demuestran que haya quedado abandonada.

El backend y los permisos de la infraestructura también deben separarse. Poder leer un state puede revelar información sensible aunque esa identidad no pueda modificar el clúster. Poder operar el clúster tampoco justifica acceso indiscriminado a todos los states de una organización.

## Sensitive oculta una salida; no cifra por sí solo el state

Para observar esta diferencia usamos un Secret Kubernetes con una **fixture pública**, nunca una contraseña real:

```hcl
resource "kubernetes_secret_v1" "example" {
  metadata {
    name      = "catalogue-dummy"
    namespace = var.namespace
  }
  # Public fixture, never a credential. It demonstrates what state can contain.
  data = { credential = "public-lab-fixture-not-a-real-secret" }
}
```

El provider marca `data` como sensible en el plan. El harness lo comprueba en la representación JSON del plan, y después verifica que el valor de la fixture aparece en la representación del state aplicado.

No publicamos ese state ni el plan completo. La evidencia conserva únicamente `secretDataMarkedSensitive: true` y `stateContainsDummyValue: true`. El test también comprueba que el informe no contiene el valor, una clave privada o los campos de credenciales del kubeconfig.

La propiedad sensible protege frente a determinadas presentaciones accidentales. No convierte cualquier archivo generado en apto para publicarlo. Un plan guardado y sus representaciones JSON requieren el mismo cuidado que los datos que contienen.

Terraform dispone de mecanismos adicionales para determinados valores efímeros y argumentos write-only cuando el recurso los soporta. No se puede deducir que un atributo concreto deje de persistirse simplemente por ser sensible. Aquí estamos comprobando el comportamiento de este recurso y provider concretos.

## State, backup de datos y recuperación del servicio son cosas distintas

Conservar el state ayuda a recuperar la gestión de recursos. No es un backup del contenido de una base de datos o de un objeto almacenado. Recrear una DB mediante Terraform puede producir infraestructura vacía si no existe otro procedimiento de restauración.

En el laboratorio, la API no contiene datos persistentes de negocio. Al destruir sus seis recursos y su clúster desaparece ese entorno ficticio. Eso permite observar el ciclo de vida sin presentar el teardown como una estrategia de recuperación de datos.

Un procedimiento de recuperación real necesita separar infraestructura, datos, secretos y conexiones de aplicaciones. También debe ensayar quién puede ejecutarlo cuando falla el sistema que suele lanzar los cambios.

## Código completo y pruebas

El [harness](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/declarative-infrastructure/scripts/exercise.mjs) contiene las comprobaciones del plan y state. Clona el [repositorio](https://github.com/luckys/luisrc-blog-examples.git) e instala sus dependencias con pnpm:

```bash
pnpm --dir packages/declarative-infrastructure test
pnpm --dir packages/declarative-infrastructure exercise
pnpm --dir packages/declarative-infrastructure verify
```

La carpeta `.artifacts` conserva diagnósticos privados ignorados. El kubeconfig de la ejecución correcta se elimina tras destruir el clúster. No introduzcas credenciales reales para repetir este ejemplo.

## Garantías y límites

Se observa state local, seis recursos gestionados y la persistencia de una fixture sensible. No se ha probado concurrencia de operadores, locking remoto, cifrado de backend, importación o recuperación de un state perdido. Que Git ignore un archivo tampoco garantiza que otras herramientas no lo copien.

## Ejercicio: recuperar la gestión sin confundirla con los datos

Supón que conservas el código, pero pierdes el state y la DB sigue existiendo. Describe qué información necesitarías para volver a gestionarla sin reemplazarla. Después invierte el fallo: conservas state, pero pierdes los datos. Explica qué parte no puede resolver ese archivo. Continúa con [módulos](/posts/terraform-modulos-variables-outputs-contratos).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Terraform state](https://developer.hashicorp.com/terraform/language/state).
- [State locking](https://developer.hashicorp.com/terraform/language/state/locking).
- [Gestión de datos sensibles](https://developer.hashicorp.com/terraform/language/manage-sensitive-data).
- [Importar infraestructura existente](https://developer.hashicorp.com/terraform/language/import).
