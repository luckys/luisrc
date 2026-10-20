---
id: API-INTEGRATION-GRAPHQL
title: 'GraphQL y N+1: un request no implica una sola lectura'
published: 2026-10-20T08:01:00Z
locale: es
translationKey: graphql-resolvers-n-mas-uno-dataloader
slug: graphql-resolvers-n-mas-uno-dataloader
draft: true
status: draft
level: intermedio
prerequisites: [P031]
description: 'Sigue la ejecución de una query GraphQL hasta sus fuentes de datos. Reproduce N+1, añade batching con DataLoader y comprueba el aislamiento de la caché por operación y tenant.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, graphql, dataloader, rendimiento, testing]
---

La pantalla necesita tres pedidos con el nombre de su cliente. Con **GraphQL** puede pedirlos en una sola operación, pero el servidor podría hacer cuatro lecturas para responder. Reducir las peticiones desde el navegador no garantiza reducir el trabajo detrás de la API.

Vamos a seguir esa operación desde el **schema** hasta los **resolvers**, reproducir el problema **N+1** y corregirlo sin mezclar datos de usuarios distintos. Usaremos los pedidos del [artículo sobre polling y eventos](/posts/polling-eventos-estado-pedido), aunque aquí el problema es la forma de leer datos, no cuándo avisar de un cambio.

## El schema describe lo que se puede pedir, no cómo se obtiene

GraphQL permite que el consumidor seleccione campos dentro de un contrato tipado. Este es el schema completo de `graphql.mjs`:

```graphql
type Customer {
  id: ID!
  name: String!
}
type Order {
  id: ID!
  status: String!
  version: Int!
  customer: Customer!
}
type Query {
  orders(first: Int!): [Order!]!
}
```

`!` marca un valor no nulo. `[Order!]!` promete una lista no nula cuyos elementos tampoco son nulos. Si el servidor no puede cumplir una posición no nula, el error puede propagarse hasta un campo padre que admita null. No es una promesa de que nunca fallará una lectura.

La operación del laboratorio pide una selección concreta:

```graphql
query Orders($first: Int!) {
  orders(first: $first) {
    id
    status
    version
    customer {
      id
      name
    }
  }
}
```

El documento y las variables viajan por separado. `first: 3` es un entero en el JSON de variables; `first: "3"` es un string y el motor lo rechaza para `Int!`. Si solicitamos `password`, que no existe en Order, la validación también falla antes de leer los pedidos.

Estas comprobaciones están ejecutadas con **GraphQL.js**, no con un parser casero. El schema no sabe que una lista de cien mil elementos es demasiado cara para nuestro servicio: además imponemos un rango de first entre uno y tres. Los tipos del protocolo y los límites operativos son controles distintos.

## Un resolver por relación puede multiplicar las lecturas

Un **resolver** es la función que obtiene el valor de un campo. Podría leer una fila, llamar a otro servicio o usar datos ya cargados. No tiene por qué corresponder a una tabla.

Para la raíz orders hacemos una lectura. Después, cada pedido necesita resolver customer. La primera implementación llama al repositorio una vez por pedido:

```javascript
async orders({ first }, context) {
  if (!Number.isInteger(first) || first < 1 || first > 3)
    throw new GraphQLError('first_out_of_range')
  const rows = await repo.orders(tenant, first)
  return rows.map((row) => ({
    ...row,
    customer: () => context.customer(row.customerId),
  }))
}
```

En la variante ingenua, `context.customer(id)` llama directamente a `repo.customer(tenant, id)`. Para tres pedidos obtenemos una lectura de pedidos y tres de clientes: **1 + N**.

El primer y tercer pedido pertenecen a Ana. Sin memoización, incluso consultamos dos veces la misma clave. El problema no es exclusivo de GraphQL: también aparece en endpoints REST, plantillas del servidor y bucles sobre un ORM. Aquí resulta fácil introducirlo porque cada resolver parece pequeño y correcto por separado.

<img src="/assets/visuals/api-contracts/API-INTEGRATION-GRAPHQL.svg" alt="Una query GraphQL obtiene tres pedidos. Sin batching, cada pedido solicita un cliente. Con DataLoader, las claves c1, c2 y c1 se reúnen y se consultan como un lote c1 y c2, conservando el orden al devolver resultados." width="275" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-INTEGRATION-GRAPHQL.svg).

La [guía de rendimiento de GraphQL](https://graphql.org/learn/performance/) explica esta diferencia entre una operación recibida y las consultas necesarias para ejecutarla. Una query flexible no trae incorporado un plan óptimo para cualquier fuente de datos.

## DataLoader agrupa claves, pero necesita una lectura por lotes real

Creamos un **DataLoader** al iniciar cada operación. Durante la ejecución reúne peticiones cercanas y llama a la función de carga con las claves pendientes:

```javascript
const loader = new DataLoader(async (ids) => {
  const rows = await repo.customers(tenant, ids)
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id) ?? null)
})
```

El repositorio tiene que ofrecer una operación útil: obtener varios clientes en una lectura. Si `repo.customers` hiciera internamente un bucle con una consulta por ID, habríamos movido N+1 a otra función.

En SQL podríamos implementar esa lectura con un filtro por tenant y un conjunto de IDs, o resolver el caso con un join desde el principio. En otro servicio dependeríamos de que su API admitiera batch. Nuestro ejercicio utiliza un Map en memoria y cuenta llamadas a métodos; **no mide round trips SQL** ni afirma que un Map represente su coste.

El orden del resultado importa. La función de batch debe devolver una posición por cada clave solicitada, en el mismo orden. El repositorio de la demo devuelve las filas deliberadamente al revés. Construir byId y recorrer ids impide asociar el cliente de un pedido a otro por confiar en el orden de llegada.

DataLoader también memoiza claves repetidas dentro de esa operación. Las peticiones para c1, c2 y c1 pueden resolverse con un lote de dos claves y reutilizar el resultado de c1. Son dos efectos diferentes: **batching** reúne lecturas; **memoización** evita repetir una clave ya solicitada. El [README de DataLoader](https://github.com/graphql/dataloader#batch-function) especifica ese contrato de posiciones y el alcance de su caché.

## Una caché global puede saltarse el aislamiento de tenant

Si guardáramos un loader global indexado solo por `customerId`, North podría cargar c1 y South recibir después ese mismo valor. El ID es igual, pero el cliente no.

Nuestra función `runQuery` crea un loader nuevo y captura el tenant de la operación. La consulta al repositorio utiliza ambos datos. Así, la caché termina con la operación y no se comparte entre consumidores. El test ejecuta la misma query primero para North y luego para South: c1 debe ser Ana en la primera y Otro cliente en la segunda.

Crear una caché por request no reemplaza los permisos. Si una misma petición incluye varios usuarios, contextos o suboperaciones con autorizaciones diferentes, ese alcance puede ser demasiado amplio. También habría que invalidar o actualizar valores tras una mutación si después se vuelven a leer dentro del mismo contexto.

La autorización debería seguir una política reutilizable, no depender de que todos los resolvers recuerden el mismo `if`. La [guía de autorización de GraphQL](https://graphql.org/learn/authorization/) recomienda mantener esas reglas en la lógica que accede al dato. En esta demo la política es pequeña: una identidad de fixture solo ve filas de su tenant. No hay usuarios ni permisos por campo de producción.

## La prueba compara resultados y trabajo, no solo ausencia de errores

El test ejecuta el mismo documento y las mismas variables contra ambas variantes. Primero exige igualdad de datos; después compara las llamadas registradas:

```javascript
assert.deepEqual(a, b)
assert.deepEqual(naive.counts, { orderReads: 1, customerReads: 3 })
assert.deepEqual(batched.counts, { orderReads: 1, customerReads: 1 })
```

Pasamos de cuatro lecturas de repositorio a dos para tres pedidos. No es una mejora del 50 % en latencia: las operaciones podrían ejecutarse en paralelo, tener costes distintos o estar cacheadas en otro nivel. Tampoco sería una diferencia importante si lo que tarda es otro campo.

El test del orden comprueba además los nombres Ana, Bea y Ana. Una optimización que devuelve rápidamente los datos del cliente equivocado no es una optimización válida.

## Una sola URL no elimina la necesidad de controlar el coste

El adaptador HTTP acepta POST con JSON, limita el cuerpo a 8 KiB, exige una identidad de fixture y solo permite el documento Orders exacto. Es una **allowlist de documentos conocidos**, no una implementación general de todas las capacidades de GraphQL over HTTP.

La allowlist evita que el consumidor cambie la forma de esta operación, incluyendo aliases o campos adicionales; el límite de first acota la lista. En una API que admita documentos arbitrarios necesitaríamos evaluar profundidad, anchura, coste por campo, tamaños de listas y límites del backend. Limitar únicamente requests por segundo no limita el trabajo de una query enorme.

No hemos añadido mutations, subscriptions, federation, un planificador SQL, límites de CPU o un gateway de producción. Desactivar introspection tampoco sustituiría autorización: conocer menos del schema no convierte un campo privado en inaccesible.

Para evolucionar el contrato, podemos añadir campos sin obligar a los consumidores existentes a pedirlos. Eliminar o renombrar uno usado sí puede romper sus documentos. Cambiar la nulabilidad también requiere revisar la dirección del cambio y si hablamos de inputs o outputs. La flexibilidad de selección no evita planificar una migración.

## Código del artículo

El [índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-integration-graphql/README.md) enlaza el [schema, repositorio y resolvers](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/graphql.mjs), el [adaptador HTTP](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/http.mjs) y los [tests con ambas variantes](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-integration/tests/integration.test.mjs).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/api-integration test
pnpm --dir packages/api-integration demo
```

Prueba a quitar customer de una operación al ejecutar `runQuery` directamente: no debería producir ninguna lectura de clientes. Después piensa si tu pantalla necesita esa flexibilidad o si un endpoint específico, con una consulta bien diseñada, resolvería el caso con menos infraestructura. La siguiente entrega cambia de problema: [gRPC y contratos entre servicios](/posts/grpc-protobuf-deadlines-compatibilidad).
