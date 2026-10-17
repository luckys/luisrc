---
id: DIST-WEBHOOKS
title: 'Webhooks seguros: verificar bytes, persistir y tolerar eventos desordenados'
published: 2026-10-17T03:04:00Z
locale: es
translationKey: reliable-webhook-inbox
slug: webhooks-firmas-inbox-eventos-desordenados
draft: true
status: draft
level: intermedio
prerequisites: [DIST-QUEUES, API-SECURITY]
description: 'Comprueba una firma HMAC sobre el body original y separa recepción duradera de aplicación. Los eventos pueden repetirse y llegar fuera de orden.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [webhooks, seguridad, hmac, inbox]
---

Un aviso anuncia que una operación terminó bien. Su JSON tiene el formato esperado, pero eso no demuestra que lo haya enviado el proveedor. Y aunque sea auténtico, quizá ya lo procesamos ayer.

Un **webhook** cruza dos fronteras: confianza y entrega. Después de [colas y ACK](/posts/colas-ack-leases-trabajos-duplicados) y [seguridad de APIs](/posts/seguridad-api-navegador-limites-confianza), diseñaremos su recepción sin dar por hecho autenticidad, orden ni entrega única.

## La firma se comprueba sobre lo que llegó

Un protocolo puede firmar un timestamp y el body original mediante **HMAC**, usando un secreto compartido. El receptor reconstruye exactamente la entrada firmada y compara el resultado de manera apropiada.

Si parseamos JSON y luego lo serializamos para verificar, pueden cambiar espacios, orden de propiedades o representación. El contenido lógico podría parecer igual y los bytes ser diferentes. Por eso el adaptador HTTP debe conservar el **raw body** según el protocolo del proveedor.

Nuestro protocolo es ficticio: firma `timestamp + "." + raw` con HMAC-SHA256, usa segundos y admite una diferencia máxima de 300 segundos. No es un SDK compatible con Stripe ni con otro PSP.

<img src="/assets/visuals/reliable-services/DIST-WEBHOOKS.svg" alt="El receptor conserva raw body, verifica firma y timestamp, guarda el evento de manera duradera y responde; después un worker deduplica y aplica una transición autorizada." width="578" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-WEBHOOKS.svg).

Archivo: `servicios-fiables/src/webhook.ts` (extracto).

```typescript
export function verify(
  raw: string,
  timestamp: number,
  signature: string,
  secret: string,
  now: number,
): boolean {
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const actual = Buffer.from(signature, 'hex')
  const expected = Buffer.from(sign(raw, timestamp, secret), 'hex')
  return timingSafeEqual(actual, expected)
}
```

El formato obliga a que ambos buffers tengan el mismo tamaño antes de compararlos. `timingSafeEqual` evita una comparación byte a byte con salida temprana; no convierte todo el handler en inmune a filtraciones temporales ni reemplaza HTTPS.

El test modifica solo un espacio del body y la firma deja de validar. También rechaza un timestamp fuera de ventana y una firma malformada. No registramos el secreto en logs; el valor del test es exclusivamente local.

## Auténtico no significa nuevo ni aplicable

Un mensaje legítimo puede repetirse dentro de su ventana de tiempo. Necesitamos un identificador estable de evento y un scope de proveedor. También comprobar que la referencia externa pertenece a la operación y al tenant esperados.

La **Inbox** registra qué mensaje aceptamos o aplicamos. Conviene distinguir ambas cosas: una fila recibida no prueba que el cambio de negocio haya terminado. Una entrada duradera puede quedar pendiente para un worker.

Respondemos `2xx` cuando hemos cumplido el contrato de aceptación, normalmente después de persistir lo necesario para recuperarnos. Responder primero y guardar después abre una ventana de pérdida. Esperar a completar un proceso lento puede provocar más retries del proveedor. La elección depende de su contrato de entrega y debe estar escrita.

## El último mensaje recibido no siempre describe el último estado

Dos avisos pueden llegar fuera de orden. «El último que recibí gana» permite revertir un éxito con un fallo atrasado. Utiliza [transiciones válidas](/posts/maquinas-estados-reglas-negocio), versiones fiables cuando existan y consulta al proveedor si la evidencia es incompatible.

No todos los tipos de webhook deben modificar el estado. Un evento desconocido puede almacenarse o descartarse con una política definida; no debería romper una cola entera. Un replay manual necesita autenticación y trazabilidad propias, no una excepción que desactive todas las firmas.

## Garantías y límites

HMAC autentica a alguien que posee el secreto y protege la integridad de lo firmado. No prueba que los datos sean comercialmente correctos. Un secreto filtrado permite falsificar; requiere almacenamiento protegido, rotación y un periodo de convivencia de claves cuando el protocolo lo permita.

El laboratorio prueba criptografía sobre strings UTF-8 y deduplicación SQL por separado. No incluye un receptor HTTP completo ni rotación de claves. El siguiente artículo muestra la transacción Inbox que evita aplicar dos veces un cambio local.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Desde `servicios-fiables/`:

```bash
node --test --test-name-pattern="webhook:" tests/core.test.mjs
```

## Ejercicio: recepción no es aplicación

Diseña estados `received`, `applied` y `rejected` para una Inbox. Define qué ocurre si el proceso cae después de guardar y antes de aplicar. Dos entregas del mismo evento deben conservar una sola aplicación, sin perder el historial del intento.

Continuamos con [Transactional Outbox e Inbox](/posts/transactional-outbox-inbox-eventos).

## Referencias

- [Stripe: webhooks, firma, duplicados y orden de entrega](https://docs.stripe.com/webhooks).
- [Node.js 24: crypto y timingSafeEqual](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
- [RFC 2104: HMAC](https://www.rfc-editor.org/rfc/rfc2104).

Fuentes consultadas el 17 de octubre de 2026. La tolerancia de 300 segundos es una decisión de la demo, no una regla universal.
