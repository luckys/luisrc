---
id: DIST-IDEMPOTENCY
title: 'Idempotencia en una API: repetir la petición sin repetir el efecto'
published: 2026-10-17T03:01:00Z
locale: es
translationKey: reliable-api-idempotency
slug: idempotencia-api-claves-efectos
draft: true
status: draft
level: intermedio
prerequisites: [DIST-FAILURES, DB-CONCURRENCY]
description: 'Define scope, fingerprint y retención de una idempotency key. Distingue deduplicación local, coordinación SQL y garantías del proveedor externo.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [idempotencia, api, postgresql, concurrencia]
---

Un cliente repite cien veces la misma solicitud porque no recibió una respuesta concluyente. Queremos reconocer una sola intención, pero no basta con guardar un identificador en memoria ni con comprobar «si ya existe» antes de insertar.

Después de [los fallos parciales](/posts/fallos-parciales-timeout-resultado-desconocido), definiremos qué significa repetir **la misma operación** y qué fronteras puede proteger cada mecanismo.

## La clave identifica una intención, no un intento

El cliente genera una **idempotency key** estable para esa intención y la conserva al reintentar. Una clave nueva en cada retry crea identidades nuevas y elimina la posibilidad de reconocer la repetición.

La clave debe tener un **scope**: por ejemplo, tenant y tipo de operación. Dos empresas pueden utilizar el mismo texto sin representar la misma intención. Además guardamos un **fingerprint** de los campos semánticos validados, como importe, moneda y recurso afectado.

Si una clave ya usada llega con otro contenido, devolvemos un conflicto definido. No ejecutamos el nuevo contenido ni devolvemos silenciosamente una respuesta de otra operación. Un hash de JSON sin una política de canonicalización puede considerar diferentes dos representaciones equivalentes; aquí usamos campos explícitos para evitar esconder esa decisión.

<img src="/assets/visuals/reliable-services/DIST-IDEMPOTENCY.svg" alt="Scope y key localizan un registro; un fingerprint igual permite recuperar el resultado, uno distinto produce conflicto, y la ejecución usa además una referencia estable con el proveedor." width="855" height="798" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-IDEMPOTENCY.svg).

## Coordinar antes de comenzar el efecto

Archivo: `reliable-services/src/distributed.ts` (extracto de `IdempotencyMemory`).

```typescript
  async run(
    scopeKey: string,
    fingerprint: string,
    effect: () => Promise<string>,
  ): Promise<string> {
    const previous = this.records.get(scopeKey)
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('conflict')
      return previous.result
    }
    const result = Promise.resolve().then(effect)
    this.records.set(scopeKey, { fingerprint, result })
    return result
  }
```

La promesa compartida se registra antes de ejecutar `effect` en la continuación. Cien llamadas en **un proceso** esperan el mismo resultado. El test cuenta efectos, no solo respuestas iguales.

Esta implementación pierde registros al reiniciar y conserva también una promesa rechazada. No tiene expiración ni recuperación de resultados inciertos. Es un modelo de coordinación local, no una solución de producción.

## En SQL, UNIQUE elimina la carrera de la reclamación

El laboratorio SQL utiliza una primary key `(scope, key)`. Dos conexiones no pueden confirmar dos registros con la misma combinación. Primero se garantiza la unicidad; después quien no obtuvo la reclamación debe leer el registro y comparar fingerprint y estado.

La versión ingenua hace `SELECT`, observa ausencia e inserta. Dos transacciones pueden observar esa ausencia. El `UNIQUE` es el punto común que coordina a todas las instancias, no una comprobación previa en cada proceso.

El test real lanza veinte conexiones concurrentes con `ON CONFLICT DO NOTHING` y comprueba que una sola obtiene la fila. Eso demuestra la reclamación SQL. No demuestra por sí solo que un efecto remoto se ejecute una vez.

## La llamada remota necesita su propio contrato

Guardar una clave local no incorpora al proveedor a la transacción. Si el proceso cae tras el efecto remoto, todavía necesitamos consultar su referencia o repetir con una identidad que el proveedor reconozca bajo su contrato.

Un registro real puede distinguir `processing`, `completed` y `uncertain`, guardar una respuesta mínima y definir qué devuelve un segundo cliente mientras el primero trabaja. Una reclamación caducada no prueba que sea seguro ejecutar otra vez.

La **retención** también limita la garantía. Si eliminas el registro a las 24 horas, un retry posterior podría parecer nuevo. Los plazos de tu API y del proveedor pueden ser diferentes. No copies sus tiempos sin diseñar el comportamiento resultante.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-idempotency/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

La deduplicación ofrece garantías dentro de un scope, una ventana y un almacenamiento concretos. No asegura **exactly once** global para efectos externos. Tampoco evita que un cliente cree dos intenciones con claves distintas para la misma compra si no existe una regla comercial adicional.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/src/distributed.ts). Desde `reliable-services/`:

```bash
node --test --test-name-pattern="idempotencia local" tests/core.test.mjs
docker compose up -d --wait
node --test --test-name-pattern="UNIQUE" tests/postgres.test.mjs
```

## Ejercicio: contrato de una clave ocupada

Define la respuesta para clave nueva, misma clave y payload, payload distinto, operación aún en curso y resultado incierto. Incluye un retry después de la retención. Si solo contemplas éxito y conflicto, todavía falta recuperación.

Seguimos con [retries acotados y backpressure](/posts/retries-deadlines-backoff-backpressure).

## Referencias

- [Stripe: contrato de idempotent requests](https://docs.stripe.com/api/idempotent_requests).
- [PostgreSQL 18: INSERT y ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html).
- [RFC 9110: semántica de métodos idempotentes](https://httpwg.org/specs/rfc9110.html#idempotent.methods).

Fuentes consultadas el 17 de octubre de 2026. Stripe sirve como comparación de contrato, no como implementación del fake.
