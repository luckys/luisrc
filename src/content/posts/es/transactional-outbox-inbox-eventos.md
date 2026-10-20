---
id: DIST-OUTBOX
title: 'Transactional Outbox e Inbox: cerrar el hueco entre guardar y publicar'
published: 2026-10-17T03:05:00Z
locale: es
translationKey: reliable-outbox-inbox
slug: transactional-outbox-inbox-eventos
draft: true
status: draft
level: intermedio
prerequisites: [DIST-WEBHOOKS, DB-TRANSACTIONS]
description: 'Guarda el evento junto al cambio local y deduplica su aplicación en el consumidor. Reproduce la caída entre publicar y marcar sin prometer exactly once global.'
author: 'Luis Ramírez Calle'
series: 'Sistemas distribuidos ante fallos reales'
tags: [outbox, inbox, postgresql, eventos, consistencia]
---

Guardamos una operación y después publicamos su evento. El proceso cae entre ambos pasos: la fila existe, pero nadie recibe el aviso. Invertir el orden tampoco lo arregla; podríamos anunciar una operación cuya transacción termine en rollback.

Es el problema de **dual write**: dos escrituras en sistemas con commits separados. Tras [la recepción de webhooks](/posts/webhooks-firmas-inbox-eventos-desordenados), resolveremos la parte que sí podemos hacer atómica y mantendremos explícita la que todavía admite duplicados.

## La Outbox guarda la intención de publicar

**Transactional Outbox** significa persistir el cambio de negocio y un evento pendiente dentro de la misma transacción local. No significa publicar en el broker dentro de ese commit.

Un proceso posterior, el **relay**, lee pendientes y los entrega. Si cae antes de publicar, el evento sigue pendiente. Si cae después de publicar y antes de marcarlo, volverá a entregarlo. Esa segunda ventana obliga al consumidor a tolerar repetición.

<img src="/assets/visuals/reliable-services/DIST-OUTBOX.svg" alt="Una transacción escribe operación y Outbox. Un relay entrega con posible repetición. Otra transacción inserta Inbox y actualiza la proyección solo si el evento no se había aplicado." width="542" height="903" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/DIST-OUTBOX.svg).

Archivo: `reliable-services/sql/02-atomic-write.sql`.

```sql
BEGIN;
INSERT INTO reliable_lab.operations(id,amount_minor,currency,state)
VALUES ('o1',1200,'EUR','processing');
INSERT INTO reliable_lab.idempotency(scope,key,fingerprint,operation_id)
VALUES ('tenant:a:create','key1','EUR:1200','o1');
INSERT INTO reliable_lab.outbox(id,operation_id,type)
VALUES ('e1','o1','operation.processing');
COMMIT;
```

El laboratorio usa identificadores fijos porque ejecuta un solo escenario. Un servicio real generará identidades estables y guardará el payload mínimo necesario para comunicar el evento. Introducir un error antes de `COMMIT` revierte las tres escrituras.

## Inbox y efecto local comparten otra transacción

Archivo: `reliable-services/sql/03-consume.sql`.

```sql
BEGIN;
WITH accepted AS (
  INSERT INTO reliable_lab.inbox(consumer,event_id)
  VALUES ('notification-projection','e1')
  ON CONFLICT DO NOTHING
  RETURNING event_id
)
INSERT INTO reliable_lab.projection(operation_id,notifications)
SELECT 'o1',1 FROM accepted
ON CONFLICT (operation_id)
DO UPDATE SET notifications = reliable_lab.projection.notifications + 1;
COMMIT;
```

La primary key de Inbox combina consumidor y evento. Solo una inserción nueva produce la fila de `accepted`; si el evento ya estaba, no se ejecuta el cambio de proyección. Si la transacción falla, tampoco queda un dedup confirmado que impida recuperar el trabajo.

`notifications` es un contador de una proyección **en PostgreSQL**, no un email enviado. Esa precisión importa: insertar en Inbox y llamar a un servicio de correo no se vuelve atómico por compartir una función TypeScript.

## Reproducir la caída sin fingir que ocurrió un crash real

El test guarda `o1` y `e1`, ejecuta el consumidor y omite marcar `published_at`. Esa omisión representa el punto de caída después de entregar. La segunda entrega ejecuta el mismo SQL y el contador sigue en uno.

Después marcamos la Outbox como publicada y comprobamos que no quedan pendientes. Es un **experimento de recuperación de estado**, no un proceso que se haya matado mientras hablaba con un broker real.

Otra prueba provoca un error tras insertar en Inbox y comprueba que el rollback permite volver a intentar. Ambas usan PostgreSQL real, no un mock de transacciones.

## El relay también necesita coordinación y operación

Para varios relays, puedes reclamar filas con una estrategia transaccional y leases, o utilizar `FOR UPDATE SKIP LOCKED` dentro de un protocolo bien definido. Mantener locks durante llamadas lentas introduce sus propios costes; soltar un lock requiere guardar una reclamación recuperable.

**Polling** es sencillo de inspeccionar y suficiente para muchos volúmenes. **CDC**, Change Data Capture, puede evitar parte del sondeo, pero añade componentes y requisitos operativos. No lo elegimos antes de necesitarlo.

Monitoriza antigüedad del pendiente más viejo, intentos y errores, no solo tamaño de cola. Define retención, replay y orden por operación. Una Outbox no es automáticamente **event sourcing**: puede transportar eventos sin que esos eventos sean el registro canónico de todo el estado.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/dist-outbox/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/reliable-services
```

## Garantías y límites

La transacción local evita que un cambio confirmado carezca de su registro Outbox. Recuperar y entregar requiere que relay y almacenamiento vuelvan a estar disponibles y que no se borren pendientes prematuramente. El esquema simple admite publicaciones repetidas y no promete orden global ni exactly once externo.

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/reliable-services/sql/02-atomic-write.sql). Desde `reliable-services/`:

```bash
docker compose up -d --wait
node --test tests/postgres.test.mjs
```

## Ejercicio: la ventana que falta

Dibuja caídas antes del commit, después del commit y después de publicar. Para cada una indica qué fila permite recuperar y qué deduplicación evita repetir el efecto local. Añade un efecto HTTP externo y explica por qué necesita un contrato adicional.

El siguiente paso conecta varias acciones mediante [sagas y compensaciones](/posts/sagas-compensaciones-workflows-duraderos).

## Referencias

- [AWS: Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
- [PostgreSQL 18: INSERT y ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html).
- [PostgreSQL 18: SELECT y SKIP LOCKED](https://www.postgresql.org/docs/18/sql-select.html).

Fuentes consultadas el 17 de octubre de 2026. Laboratorio ejecutado con PostgreSQL 18.4.
