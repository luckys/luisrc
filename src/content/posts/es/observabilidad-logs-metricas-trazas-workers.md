---
id: OPS-SIGNALS
title: 'Observabilidad de una operación: seguirla de la API al worker'
published: 2026-10-17T04:01:00Z
locale: es
translationKey: reliable-observability
slug: observabilidad-logs-metricas-trazas-workers
draft: true
status: draft
level: intermedio
prerequisites: [OPS-FAULTS]
description: 'Conecta logs, métricas y trazas mediante identidades con significado. Observa backlog y resultados inciertos sin registrar secretos ni crear cardinalidad ilimitada.'
author: 'Luis Ramírez Calle'
series: 'Probar y operar servicios fiables'
tags: [observabilidad, logs, metricas, tracing]
---

El endpoint respondió bien, pero una operación sigue pendiente. El dashboard de HTTP está verde y el worker solo escribe «error al procesar». No sabemos qué intento falló, si volverá a ejecutarse ni cuánto tiempo lleva esperando.

Después de [las pruebas de fallos](/posts/fault-injection-pruebas-propiedades), necesitamos señales que permitan investigar esas mismas fronteras fuera del test. La unidad que seguimos es una operación de negocio, no únicamente una petición HTTP.

## Usa identificadores que respondan preguntas distintas

Un **request ID** identifica una interacción HTTP. Un **operation ID** conecta su intención comercial con retries, webhooks y reconciliación. Un **attempt ID** diferencia intentos. Un **event ID** permite reconocer un mensaje concreto.

Un **trace ID** relaciona spans dentro de un contexto de tracing. No sustituye necesariamente la identidad de negocio: una operación puede durar horas y participar en varias trazas. Tampoco uses la idempotency key cruda como identificador público si puede contener información sensible.

<img src="/assets/visuals/reliable-services/OPS-SIGNALS.svg" alt="La API registra operation ID, crea una Outbox y transmite contexto al worker; logs, métricas agregadas y spans permiten observar el mismo recorrido sin compartir secretos." width="577" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/OPS-SIGNALS.svg).

## Los logs necesitan estructura y selección

Archivo: `servicios-fiables/src/service.ts` (extracto).

```typescript
export function operationLog(input: Record<string, unknown>) {
  return {
    operation_id: input.operation_id,
    attempt: input.attempt,
    status: input.status,
  }
}
```

La **allowlist** evita copiar automáticamente `authorization`, email o body a un registro. El test envía esas propiedades y comprueba que no aparecen. No es un sanitizer universal: un desarrollador aún podría introducir un secreto en `operation_id`. También hacen falta límites y semántica en esos valores.

Un log real puede incluir timestamp, nivel, nombre estable de evento y causa controlada. Prefiere `provider.response_lost` a un texto ambiguo que obligue a buscar todas las formas de decir «falló». La estructura facilita filtrar sin depender de frases humanas.

## Las métricas resumen, no guardan cada identidad

Mide tasa de solicitudes, errores, duración y saturación. Para procesos asíncronos, añade pendientes, edad del más antiguo, operaciones inciertas e intentos de reconciliación. Una cola de diez mensajes puede ser urgente si el primero lleva horas atascado.

Evita `operation_id`, email o URLs arbitrarias como labels de métricas: generan **cardinalidad** sin límite útil y pueden filtrar datos. Un conjunto acotado como proveedor, resultado y tipo de operación suele ser más manejable.

Un contador de duplicados suprimidos ayuda a conocer el comportamiento del protocolo. No debe convertirse por sí solo en una alarma: recibir duplicados puede ser normal. La alerta necesita una consecuencia relevante, como crecimiento de pendientes sin recuperación.

## Las trazas muestran el recorrido y las esperas

Un **span** representa una operación delimitada en una traza, con contexto y tiempos. El contexto puede propagarse por HTTP y por mensajes para conectar productor y consumidor mediante relaciones apropiadas.

La espera en cola no es necesariamente tiempo de ejecución del worker. Distingue edad del mensaje, duración de procesamiento y latencia total de negocio. Una traza muestreada puede no contener la operación que buscas; los identificadores de negocio y métricas siguen siendo necesarios.

**OpenTelemetry** estandariza instrumentación y transporte de señales. No es, por sí mismo, el almacenamiento ni la interfaz de consulta. Elegir un collector y un backend es otra decisión operativa.

## Garantías y límites

El laboratorio verifica selección de campos y cálculos, no instala un collector ni genera spans exportados. El diagrama representa la instrumentación recomendada para el integrador. No afirmamos haber trazado una petición desde React hasta el worker.

Logs e identificadores necesitan control de acceso y retención. Registrar más no siempre ayuda: puede aumentar coste y ocultar el evento importante entre datos repetidos.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Desde `servicios-fiables/`:

```bash
node --test --test-name-pattern="operación registrada" tests/core.test.mjs
```

## Ejercicio: diagnosticar sin body completo

Diseña tres logs para una respuesta perdida: intento iniciado, resultado incierto y reconciliación confirmada. Deben enlazarse por operación y distinguir intentos sin contener tokens, secretos ni datos personales. Después elige dos métricas que detectarían un bloqueo del reconciliador.

Seguimos con [percentiles y saturación en pruebas de carga](/posts/pruebas-carga-percentiles-saturacion).

## Referencias

- [OpenTelemetry: signals](https://opentelemetry.io/docs/concepts/signals/).
- [OpenTelemetry: propagación de contexto](https://opentelemetry.io/docs/concepts/context-propagation/).
- [Google SRE: monitoring de sistemas distribuidos](https://sre.google/sre-book/monitoring-distributed-systems/).
- [OWASP: logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

Fuentes consultadas el 17 de octubre de 2026.
