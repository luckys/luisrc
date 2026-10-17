---
id: DB-STORAGE
title: 'SQL, NoSQL y motores especializados: elige por requisitos, no por etiquetas'
published: 2026-10-17T00:12:00Z
locale: es
translationKey: database-storage-engine-selection
slug: elegir-sql-nosql-motores-especializados
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL, DB-INDEXES, DB-CACHE]
description: 'Compara almacenamiento relacional, documental, key-value y motores de búsqueda, series temporales y vectores según accesos, consistencia y coste operativo.'
author: 'Luis Ramírez Calle'
series: 'Fundamentos de bases de datos'
tags: ['bases-de-datos', 'postgresql', 'nosql', 'mongodb', 'redis', 'arquitectura']
---

El equipo quiere añadir una base documental porque la API devuelve JSON. Otro propone un motor de búsqueda porque PostgreSQL ya tiene muchos registros. Ninguna de esas observaciones explica todavía qué operación no cumple los requisitos ni cómo cambiaría con el nuevo motor.

Elegir almacenamiento empieza por accesos, reglas y fallos aceptables. Las etiquetas **SQL** y **NoSQL** agrupan productos muy distintos; no sustituyen a esa descripción.

Cerramos el bloque de fundamentos después de [modelado](/posts/modelado-relacional-integridad-datos), [índices](/posts/indices-postgresql-fundamentos) y [caché](/posts/redis-cache-consistencia). Vamos a comparar opciones y construir una ficha de decisión. La comparación entre motores será conceptual: el laboratorio ejecuta PostgreSQL y Redis, no MongoDB ni DynamoDB.

## Escribe los accesos antes de escoger el modelo

Para una tienda ficticia, necesitamos crear un pedido con sus líneas, impedir referencias inexistentes, mostrar el pedido completo, buscar productos por texto y calcular ventas mensuales.

Son preguntas distintas. La búsqueda tolera quizá unos segundos de retraso; confirmar un pedido exige conservar sus líneas y reglas. Una sola tecnología puede satisfacer varias, pero no debes asumir que todas requieren exactamente el mismo contrato.

<img src="/assets/visuals/database-series/motores.svg" alt="Los requisitos de accesos, invariantes y fallos guían hacia almacenamiento relacional, documental, key-value o especializado. La elección parte del contrato y no de una etiqueta SQL o NoSQL." width="1135" height="662" loading="lazy" style="width:100%;height:auto" />

[Ampliar el recurso visual](/assets/visuals/database-series/motores.svg).

Define también volumen estimado, tamaños, frecuencia de modificación, latencia objetivo, retención y necesidades de recuperación. Si usas cifras hipotéticas para planificar, márcalas como tales. No conviertas una previsión en un benchmark medido.

## Relacional: relaciones explícitas y consultas combinables

Un motor relacional como **PostgreSQL** permite expresar claves, referencias y restricciones, además de combinar conjuntos mediante SQL. Es un punto de partida razonable cuando las reglas cruzan entidades y necesitas consultas que evolucionan.

No significa que todas las operaciones deban convertirse en joins enormes ni que no puedas almacenar JSON. Tampoco que una aplicación relacional escale sin límites: debes diseñar índices, conexiones, retención y contención.

**Mito: «si la API devuelve JSON, necesitas una base documental».** La forma del transporte no decide la persistencia. Podemos construir una proyección JSON desde datos relacionales.

Archivo: `bases-de-datos/sql/13-motores.sql`.

```sql
\ir 01-modelo.sql
SELECT o.id,jsonb_build_object(
  'customer_id',o.customer_id,
  'currency',o.currency,
  'items',jsonb_agg(jsonb_build_object('sku',i.sku,'quantity',i.quantity)
    ORDER BY i.sku)
) AS document
FROM db_model.orders o JOIN db_model.order_items i ON i.order_id=o.id
GROUP BY o.id ORDER BY o.id;
```

[Descarga el laboratorio](/assets/examples/bases-de-datos-lab.zip), entra en `bases-de-datos/` y ejecuta:

Archivo: terminal.

```bash
docker compose up -d --wait
docker compose exec -T postgres psql -X -U lab -d series_lab -v ON_ERROR_STOP=1 -f /lab/sql/13-motores.sql
```

El resultado es JSON, pero las foreign keys siguen protegiendo las filas originales. Almacenar directamente un documento JSONB tendría un contrato distinto: sus campos internos no heredan automáticamente todas esas constraints. [Funciones JSON de PostgreSQL](https://www.postgresql.org/docs/18/functions-json.html).

## Documentos: agrupar lo que se lee y modifica junto

Un modelo documental puede almacenar un pedido con sus líneas dentro de un documento. Si se accede como una unidad acotada y sus campos cambian juntos, **embedding** puede simplificar el acceso.

**MongoDB** también permite referencias y transacciones; «NoSQL no tiene transacciones» es un mito. La decisión sigue requiriendo límites de tamaño, patrones de crecimiento y el coste de mantener relaciones o copias entre documentos. [Modelado de datos en MongoDB](https://www.mongodb.com/docs/manual/data-modeling/).

No incrustes sin límite el historial completo de compras dentro de cada cliente. Un documento que crece continuamente puede dejar de corresponder a una unidad práctica de acceso. Compara **embedding** con **references** para ese caso. [Buenas prácticas de modelado](https://www.mongodb.com/docs/manual/data-modeling/best-practices/).

La flexibilidad de estructura tampoco elimina el esquema del producto. Si distintas versiones de un documento circulan a la vez, la aplicación necesita validarlas, interpretarlas y migrarlas.

## Key-value y wide-column: diseñar alrededor de las claves de acceso

Un almacén **key-value** ofrece un acceso natural por clave. **Redis** añade estructuras y comandos que lo hacen útil para caché, contadores y otros casos. Ya vimos que usarlo como caché requiere decidir fuente de verdad y expiración; no debemos dar por hecho que cualquier configuración ofrece la persistencia necesaria.

En modelos orientados a particiones, como el diseño habitual de **DynamoDB**, anticipar los access patterns influye mucho en las claves e índices. Las consultas que en SQL combinan libremente relaciones pueden requerir otra organización de datos. [Diseño de datos en DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-modeling-nosql.html).

**Wide-column**, como la familia de modelos de Cassandra, organiza datos alrededor de claves de partición y estructuras de consulta; no equivale a un almacén columnar analítico. DynamoDB tampoco debe presentarse como sinónimo de todos los motores NoSQL. [Modelado lógico de Cassandra](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/data-modeling_logical.html).

**Mito: «NoSQL siempre es eventually consistent».** La garantía depende del producto, la operación y la configuración. Por ejemplo, DynamoDB distingue lecturas eventualmente consistentes de lecturas fuertemente consistentes donde están soportadas; los índices secundarios globales tienen otras limitaciones. [Read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html).

## Los motores especializados optimizan otra pregunta

Un motor de **search** aporta capacidades de indexación, análisis de texto y relevancia. Su proyección de búsqueda puede tardar en reflejar una escritura confirmada en otro sistema. **Elasticsearch** documenta una búsqueda **near real-time**, no una promesa de visibilidad inmediata de toda escritura. [Near real-time search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search).

Una base de **time-series** se orienta a datos temporales y sus patrones de ingestión, retención y consulta. Eso no significa que cualquier tabla con una fecha necesite otro motor: primero revisa qué le falta al almacenamiento actual.

Los **vector stores** permiten buscar similitud entre representaciones numéricas. Con índices aproximados intercambias calidad de recuperación por recursos y latencia. Similaridad no equivale a verdad semántica ni autorización: los filtros y permisos siguen siendo parte del diseño. PostgreSQL también puede ofrecer búsquedas vectoriales mediante extensiones como [pgvector](https://github.com/pgvector/pgvector).

## Compara cuatro opciones sobre el mismo contrato

Esta tabla es una comparación de diseño, **no un benchmark** ni una clasificación de velocidad.

<div class="overflow-x-auto" role="region" aria-label="Comparación de almacenamiento para pedidos" tabindex="0">

| Necesidad                   | PostgreSQL                     | MongoDB                          | DynamoDB                                              | Redis como caché                        |
| --------------------------- | ------------------------------ | -------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| Pedido con líneas           | Tablas y transacción           | Documento embebido o referencias | Diseñar items y accesos; transacciones cuando proceda | Proyección reconstruible                |
| Relaciones entre entidades  | FK y constraints               | Modelado y garantías específicas | Modelado y operaciones condicionales                  | No sustituye las reglas de origen       |
| Nuevas consultas analíticas | SQL, revisar coste             | Aggregation y revisar índices    | Puede exigir nuevos índices o proyecciones            | Normalmente otro sistema                |
| Coste adicional a estudiar  | Operación, índices, contención | Crecimiento y relaciones         | Distribución de claves, capacidad y coste             | Invalidación, memoria y fallo de origen |

</div>

La alternativa más sencilla puede ser conservar PostgreSQL, mejorar consultas y añadir una proyección solo cuando exista una necesidad comprobada. **Polyglot persistence** añade opciones, pero también sincronización, backups, observabilidad, permisos y personal capaz de operar cada pieza.

## Garantías y límites

Ninguna familia garantiza escalabilidad, disponibilidad o consistencia únicamente por su etiqueta. Describe qué ocurre si una escritura se confirma, si una lectura llega después y si la red separa componentes. Un timeout puede dejar un resultado desconocido; cambiar de motor no elimina ese problema.

El laboratorio verifica la proyección JSON y los ejemplos de Redis de la serie. **No hemos ejecutado una comparativa de rendimiento entre PostgreSQL, MongoDB, DynamoDB y Redis.** Para hacerla harían falta implementaciones equivalentes, datasets, configuración y medidas reproducibles, incluyendo operaciones y recuperación, no solo lecturas exitosas.

## Ejercicio: escribe una decisión que pueda discutirse

Elige un proyecto sin casarte todavía con una tecnología. Escribe cinco accesos, tres invariantes y dos fallos a soportar. Compara al menos dos diseños; incluye cuál introduces primero, por qué descartas el otro y qué evidencia te haría reconsiderarlo.

Acepta el ejercicio cuando puedas explicar una desventaja de tu elección. Esa ficha, junto con los experimentos anteriores, es una base útil para construir proyectos sin repetir sus decisiones por intuición o por moda.

## Referencias

Consultadas el 17 de octubre de 2026: [JSON de PostgreSQL 18](https://www.postgresql.org/docs/18/functions-json.html), [modelado de MongoDB](https://www.mongodb.com/docs/manual/data-modeling/), [embedding y referencias](https://www.mongodb.com/docs/manual/data-modeling/best-practices/), [modelado de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-modeling-nosql.html), [consistencia de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html), [búsqueda near real-time de Elasticsearch](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search) y [pgvector](https://github.com/pgvector/pgvector).
