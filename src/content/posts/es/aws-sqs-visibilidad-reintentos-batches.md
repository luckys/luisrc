---
id: "AWS-SQS"
title: "SQS: consumir mensajes con visibilidad, reintentos y fallos parciales"
published: "2026-10-25T14:07:00Z"
locale: "es"
translationKey: "aws-foundations-aws-sqs"
slug: "aws-sqs-visibilidad-reintentos-batches"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-S3", "AWS-LAMBDA"]
description: "Cómo separar recibir, procesar y confirmar un mensaje sin prometer exactly-once. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La subida del documento termina, pero generar su vista previa tarda demasiado para mantener abierta la petición HTTP. Una cola permite aceptar el trabajo y procesarlo después. A cambio, hay que resolver qué sucede si el consumer se cae a mitad de camino.

**SQS** es una cola gestionada. Después de [almacenar objetos en S3](/posts/aws-s3-objetos-keys-acceso), nos centraremos en una **Standard queue** consumida por Lambda y en tres operaciones distintas: recibir un mensaje, producir su efecto y confirmar que terminó.

## Recibir no borra el mensaje

Al recibir un mensaje, SQS lo mantiene en la cola y lo oculta temporalmente mediante el **visibility timeout**. Si el procesamiento termina, hay que eliminarlo. En la integración gestionada con Lambda, el event source mapping realiza la gestión del batch según el resultado del handler.

Si el worker falla antes de confirmar y expira la visibilidad, el mensaje puede volver a entregarse. En Standard debemos contar con entregas **at least once** y posibles duplicados; la visibilidad no constituye una garantía de ejecución única.

Piensa en un consumer que genera y guarda la vista previa, pero se cae antes de confirmar. El siguiente intento verá el mismo trabajo aunque el efecto ya exista. Por eso el identificador de operación, su estado durable y la política de **idempotency** pertenecen al diseño de la aplicación.

Guardar IDs procesados en un `Set` en memoria solo protege ese proceso hasta que se reinicia. Incluso una tabla durable necesita coordinar la marca con el efecto. Si el efecto es externo, como enviar un correo, hay que analizar la ventana de fallo y las capacidades del destinatario.

<img src="/assets/visuals/aws-foundations/AWS-SQS.svg" alt="Un batch Standard contiene a, b y c. Si solo b falla, la respuesta parcial habilitada reporta ese ID; su reentrega requiere efectos idempotentes y no demuestra ejecución exactamente una vez." width="260" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-SQS.svg).

## Un fallo parcial no debería repetir todos los éxitos del batch

Supongamos un batch con mensajes `a`, `b` y `c`. El segundo falla y los otros terminan. Devolver un error global puede provocar nuevos intentos del batch completo. Con **ReportBatchItemFailures**, Lambda permite indicar los IDs que necesitan reintento.

El helper de `src/contracts.ts` procesa secuencialmente y devuelve esa respuesta:

```typescript
export async function processStandardBatch(records: { messageId: string; body: string }[], process: (body: string) => Promise<void>) {
  const batchItemFailures: { itemIdentifier: string }[] = []
  for (const record of records) {
    try { await process(record.body) }
    catch { batchItemFailures.push({ itemIdentifier: record.messageId }) }
  }
  return { batchItemFailures }
}
```

El test hace fallar únicamente `b` y obtiene `batchItemFailures: [{ itemIdentifier: 'b' }]`. Se sigue intentando `c` porque el contrato del ejemplo es Standard y los mensajes se tratan como trabajos independientes.

La configuración del event source mapping debe habilitar la respuesta parcial. Devolver el objeto correcto desde una función local no activa esa opción en AWS. Un fallo que haga terminar el handler antes de construir la respuesta también requiere atención: este helper no garantiza supervivencia a un crash o timeout global.

En una cola **FIFO**, el orden exige otro tratamiento: después del primer fallo hay que evitar continuar como si el resto fuese independiente y reportar también los elementos no procesados que corresponda. No reutilizamos este helper Standard como un handler FIFO correcto.

## La visibilidad debe dejar margen para el procesamiento y los reintentos

El plan de ejemplo fija timeout de función en 10 segundos, batch window de 5 y visibilidad en 90. Nuestra política local adopta la recomendación AWS de dejar al menos seis veces el timeout más la ventana de acumulación:

`visibilidad recomendada mínima = 6 × 10 + 5 = 65 segundos`

No hay que confundir esa recomendación con la validación mínima al crear el mapping: AWS exige que el timeout de función no supere la visibilidad. El preflight del laboratorio es deliberadamente más estricto porque representa nuestra política de diseño.

Una visibilidad corta puede solapar intentos de trabajo que aún no ha terminado. Una demasiado larga puede retrasar la recuperación de un consumer caído. Para procesos variables también hay que valorar extensiones controladas de visibilidad y límites de duración.

## Una dead-letter queue conserva el fallo; no lo soluciona

Después de varios intentos, una **DLQ** permite apartar mensajes que no terminan correctamente. Nuestro plan declara `maxReceiveCount: 5`. No hemos creado ni conectado esa cola: es una decisión pendiente de implementación cloud.

Un mensaje mal formado y una dependencia temporalmente caída no deberían investigarse igual. Interesa conservar el motivo de fallo, la edad del trabajo y el identificador de operación, sin volcar datos sensibles. Una alerta útil distingue backlog creciente, fallos de procesamiento y mensajes en DLQ.

El **redrive** vuelve a introducir trabajo. Antes de hacerlo hay que corregir la causa y comprobar idempotencia. Reenviar masivamente puede repetir efectos o saturar la dependencia que acaba de recuperarse.

## Código completo y pruebas

Consulta el [plan Standard](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/queue-plan.json) y los [tests de contratos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/tests/contracts.test.mjs). Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` y la instalación con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

El informe conserva el fallo parcial de `b` y la aceptación del plan de visibilidad. Ningún mensaje se ha enviado o recibido desde SQS real.

## Garantías y límites

Se verifica el resultado del helper con errores controlados y un preflight local. No hay entrega SQS, mapping, DLQ, redrive o idempotencia durable implementados. El precio de SQS queda fuera del subtotal de la API de lectura. La respuesta parcial reduce reintentos innecesarios; no promete **exactly-once** para los efectos.

## Ejercicio: caer después de guardar la vista previa

Dibuja el fallo entre persistir el resultado y confirmar el mensaje. Decide cómo comprobará el siguiente intento si debe repetir la generación. Después provoca un fallo antes de persistir y explica por qué no puedes marcar ambos casos como «procesado» al recibir el mensaje. Continúa con [RDS](/posts/aws-rds-postgresql-backups-operacion).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Visibilidad y mensajes en vuelo](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html).
- [Configurar SQS con Lambda](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-configure.html).
- [Errores y respuestas parciales](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html).
- [Standard queues y at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html).
