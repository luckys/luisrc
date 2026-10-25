---
id: "AWS-DYNAMODB"
title: "DynamoDB: empezar por las consultas antes de elegir las claves"
published: "2026-10-25T14:09:00Z"
locale: "es"
translationKey: "aws-foundations-aws-dynamodb"
slug: "aws-dynamodb-claves-access-patterns"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-RDS", "AWS-IAM"]
description: "Cómo decidir key, lectura y coste sin trasladar automáticamente un modelo relacional. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La API solo necesita leer un producto por identificador, pero su implementación recorre toda la tabla y filtra el resultado. La consulta devuelve el dato correcto durante una demo. El trabajo que hace para encontrarlo crece con un catálogo que no necesitaba recorrer.

**DynamoDB** exige pensar cómo accederemos al dato antes de dar por terminado su modelo. Después de [RDS](/posts/aws-rds-postgresql-backups-operacion), vamos a diseñar una lectura por clave sin asumir que una base key-value/documental funciona como una base relacional con otra sintaxis.

## Un access pattern describe una operación concreta

Para nuestro catálogo el **access pattern** inicial es «obtener el producto con este `id`». Conocemos la clave antes de consultar. Una tabla con partition key `id` permite representar esa operación directamente.

Si la necesidad fuese «listar los productos activos de un vendedor ordenados por fecha», tendríamos que diseñar otra distribución de claves o un índice. Escribir después un filtro sobre toda la tabla puede ocultar que no diseñamos el acceso requerido.

Una primary key puede ser simple, con **partition key**, o compuesta, con partition key y **sort key**. En la compuesta, la pareja identifica el item. No estamos obligados a utilizar una sort key si nuestra operación no la necesita.

El diseño de claves también distribuye trabajo. Una clave que concentra muchas peticiones puede convertirse en un punto de presión. No basta con que el número total de items parezca grande para deducir que la carga está bien repartida.

## GetItem construye una lectura por clave

El laboratorio genera la entrada del API de bajo nivel de DynamoDB:

```typescript
export function catalogueGetItemInput(id: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) throw Error('invalid_item_id')
  return { TableName: 'catalogue', Key: { id: { S: id } }, ConsistentRead: true }
}
```

`S` indica un atributo de tipo string en ese formato del SDK. El helper no envía la petición. Con una abstracción como Document Client, el código de marshalling sería diferente; aquí mantenemos visible el contrato que queremos revisar.

El identificador se valida antes de construir la entrada. El test comprueba que elegimos tabla, key y consistencia. Eso ayuda a detectar que alguien sustituya accidentalmente la operación por un recorrido o quite la clave, pero no mide rendimiento.

La autorización propuesta permite `dynamodb:GetItem` sobre la tabla del catálogo. Si después añadimos un índice y una nueva operación, habrá que revisar también esos permisos. Un cambio de access pattern puede afectar al modelo, a la capacidad y a IAM.

<img src="/assets/visuals/aws-foundations/AWS-DYNAMODB.svg" alt="El access pattern de obtener un producto por id permite una primary key simple y GetItem con lectura fuerte de tabla. Otro acceso requiere revisar claves o índices, no añadir un filtro sobre todo el catálogo." width="299" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-DYNAMODB.svg).

## Query y Scan no son filtros intercambiables

**Query** permite buscar items usando un valor de partition key y, cuando corresponde, condiciones sobre sort key. Un **Scan** recorre datos de la tabla o índice. Añadir un filtro al Scan no lo transforma en una búsqueda directa por clave.

La API de catálogo usa **GetItem** porque pide exactamente una primary key. No introducimos Query, índices o un diseño single-table para una operación que no los requiere. Tampoco concluimos que sean innecesarios para una aplicación con otras consultas.

Un índice secundario puede servir a otro acceso, a cambio de almacenamiento, escrituras y reglas de consistencia propias. La flexibilidad del esquema de atributos no elimina el trabajo de mantener invariantes de negocio o cambiar datos existentes.

Si necesitas joins variados, informes ad hoc y transacciones relacionales complejas, merece la pena comparar una base relacional antes de forzar cada consulta a una nueva key. Elegir DynamoDB para esta lectura no significa que deba contener todos los datos de cualquier servicio.

## ConsistentRead es una decisión sobre la lectura

Las lecturas de tablas y **LSI** pueden ser eventualmente consistentes o fuertemente consistentes. El helper establece `ConsistentRead: true` para leer el item de la tabla con la garantía correspondiente a las escrituras confirmadas anteriores.

Las lecturas de **GSI** y streams son eventualmente consistentes. No se obtiene una lectura fuerte de un GSI copiando el booleano del ejemplo. En global tables existen modos de consistencia diferentes, como MREC y MRSC; no generalizamos que todo acceso multirregión tenga el mismo comportamiento.

Una lectura fuerte del item no mantiene el valor congelado después de devolverlo. Otro proceso puede modificarlo inmediatamente. Si hay una regla de actualización condicionada al estado leído, necesitaremos una operación condicional o una transacción adecuada, no solo pedir una lectura más fuerte.

En el catálogo elegimos lectura fuerte para hacer explícito el supuesto. No hemos demostrado que sea necesaria para todos sus usuarios. Si aceptasen temporalmente una versión anterior, podríamos revisar esa decisión y su coste, además de comprobar sus efectos en la interfaz.

## Gestionar capacidad sigue exigiendo conocer la carga

DynamoDB ofrece modalidades de capacidad como on-demand y provisioned. El consumo depende de las operaciones, el tamaño de los items y las opciones de consistencia. Contar peticiones HTTP no basta para facturar DB si cada una puede producir varias lecturas o reintentos.

En la comparación Lambda/ECS dejamos la base como dependencia común y excluimos su precio. «Común» no significa gratuita ni que el coste vaya a ser idéntico en producción: los patrones de acceso reales podrían divergir. Medirlos sería parte del siguiente estudio.

El reader usado por ambos adaptadores devuelve un producto ficticio desde código. Por eso los cuatro resultados HTTP no contienen evidencia de consistencia, latencia, distribución de claves o consumo de DynamoDB.

## Código completo y pruebas

Los [contratos de consulta](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/src/contracts.ts) y el [diseño Lambda](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/lambda.json) están en el monorepo. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` y la instalación con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

## Garantías y límites

El helper construye GetItem por una clave concreta y declara lectura fuerte de tabla. No crea la tabla, consulta AWS, mide capacidad o prueba aislamiento multitenant. El reader ficticio no simula la consistencia del servicio.

## Ejercicio: añadir una consulta por vendedor

Escribe los datos de entrada, el orden, el volumen esperado y la paginación de «productos de un vendedor». Decide si la key actual lo resuelve y qué índice o modelo alternativo propondrías. Explica qué información falta antes de elegir. Continúa con [la comparación Lambda/ECS](/posts/api-lambda-ecs-costes-supuestos), que reúne supuestos y partidas.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Claves, items e índices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html).
- [Consistencia de lectura](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html).
- [Query](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html).
- [Scan](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html).
