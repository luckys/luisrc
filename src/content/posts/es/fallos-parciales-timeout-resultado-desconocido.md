---
id: DIST-FAILURES
title: 'Fallos parciales: un timeout no te dice si la operación se ejecutó'
published: 2026-10-17T03:00:00Z
locale: es
translationKey: reliable-partial-failures
slug: fallos-parciales-timeout-resultado-desconocido
draft: true
status: draft
level: intermedio
prerequisites: [DESIGN-STATES, API-ASYNC]
description: 'Distingue el estado de una conexión del resultado de negocio. Reproduce una respuesta perdida después del efecto y conserva explícita la incertidumbre.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [sistemas-distribuidos, timeout, backend, resiliencia]
---

El proveedor ejecutó la operación, pero su respuesta no llegó. Nuestro cliente agotó el tiempo de espera. Si registra «fallida» y vuelve a crear otra operación, puede repetir un efecto que ya ocurrió.

Abrimos **Sistemas distribuidos ante fallos reales** con esa separación: lo que observamos en la red no siempre permite conocer lo que pasó en el otro sistema. Necesitas [asincronía](/posts/asincronia-nodejs-carreras-concurrencia) y la [máquina de estados](/posts/maquinas-estados-reglas-negocio).

## El fallo puede ocurrir después de la escritura

Una interacción tiene varios momentos: construir la petición, enviarla, recibirla, ejecutar el efecto y devolver la respuesta. Una conexión rota puede impedir distinguir en cuál se produjo el problema.

**Timeout** significa que no obtuvimos un resultado dentro del tiempo elegido. No significa «el servidor no recibió nada». Cancelar la espera o cerrar el socket tampoco revierte automáticamente el trabajo remoto.

Un rechazo de negocio confirmado es información distinta: «sin disponibilidad» puede ser una respuesta concluyente para ese intento. Un `500` incluso puede aparecer después de un efecto, dependiendo del contrato y del punto de fallo. No basta con clasificar todos los status 5xx como «no ejecutado».

<img src="/assets/visuals/reliable-services/DIST-FAILURES.svg" alt="La API envía una operación al proveedor, el proveedor confirma su efecto local y la respuesta se pierde; la API observa timeout y conserva Unknown." width="546" height="788" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-FAILURES.svg).

## Un fake permite aislar la incertidumbre

Archivo: `servicios-fiables/src/distributed.ts` (extracto de `ProviderFake`).

```typescript
  async execute(id: string, loseResponse = false): Promise<'succeeded'> {
    if (!this.operations.has(id)) {
      this.effects++
      this.operations.set(id, 'succeeded')
    }
    if (loseResponse) throw new Error('response_lost')
    return 'succeeded'
  }
```

El efecto se registra antes de lanzar `response_lost`. La excepción representa que el cliente perdió la respuesta, no que el proveedor deshizo su operación. El test comprueba tanto el error observado como `effects === 1` y la consulta posterior por el mismo identificador.

Este fake utiliza memoria y un contrato deliberadamente sencillo. No afirma imitar todos los estados de un PSP ni una red real. Su utilidad es impedir que confundamos «se lanzó una excepción» con «no ocurrió ningún efecto».

## Dos sistemas no comparten una transacción por hablar HTTP

Una transacción de PostgreSQL protege escrituras locales. Mantenerla abierta mientras llamamos al proveedor no incorpora su base de datos al commit local. Podemos tener éxito remoto y rollback local, o lo contrario.

También hay retrasos y mensajes fuera de orden. El reloj de una máquina no ofrece automáticamente un orden global; comparar timestamps de dos sistemas requiere conocer sus condiciones y tolerancias. Para coordinar cambios solemos necesitar identidades, versiones y reglas, no solo «quedarse con la fecha mayor».

Los protocolos de consenso permiten determinadas garantías entre nodos bajo supuestos concretos. No resuelven por sí solos una integración HTTP con un tercero que no participa en ese protocolo.

## CAP no significa elegir dos propiedades para siempre

El resultado CAP habla de lo que no puede satisfacerse simultáneamente bajo una partición, con definiciones concretas de consistencia y disponibilidad. No es un menú para etiquetar toda una aplicación como «AP» o «CP» sin describir su comportamiento.

Para este servicio la pregunta práctica es más pequeña: si no podemos consultar al proveedor, ¿respondemos con una operación pendiente, rechazamos una nueva intención o repetimos una acción? Elegiremos según el riesgo y la semántica, no invocando una sigla como permiso para perder información.

## Garantías y límites

Conservar `unknown` evita declarar un resultado sin evidencia, pero no lo resuelve. Hacen falta una consulta posterior, un webhook confiable o revisión manual. También debemos comunicar ese estado a la UI: «no confirmado todavía» no es equivalente a «vuelve a comprar».

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Desde `servicios-fiables/`:

```bash
node --test --test-name-pattern="timeout tras efecto" tests/core.test.mjs
```

## Ejercicio: una tabla de observaciones

Describe tres puntos de fallo: antes de recibir, después del efecto y después de guardar la respuesta local. Para cada uno indica qué sabe realmente el cliente y qué evidencia necesita. El mismo timeout debe admitir más de una historia posible.

La siguiente entrega desarrolla [idempotencia y claves estables](/posts/idempotencia-api-claves-efectos), necesarias para repetir sin crear otra intención.

## Referencias

- [AWS: timeouts, retries y backoff con jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
- [Gilbert y Lynch: imposibilidad de disponibilidad y consistencia bajo particiones](https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf).
- [PostgreSQL 18: transacciones locales](https://www.postgresql.org/docs/18/tutorial-transactions.html).

Fuentes consultadas el 17 de octubre de 2026. El experimento es un modelo de fallo, no una medición de red.
