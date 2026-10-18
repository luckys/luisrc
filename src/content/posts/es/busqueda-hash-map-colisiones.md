---
id: DSA-09
title: 'Hashing y Map: buscar por clave sin olvidar colisiones ni actualizaciones'
published: 2026-10-18T03:07:00Z
locale: es
translationKey: dsa-hashing-map
slug: busqueda-hash-map-colisiones
draft: true
status: draft
level: intermedio
prerequisites: [DSA-07]
description: 'Cómo funciona un índice hash, qué significa el coste esperado y por qué construir un Map exige decidir duplicados, igualdad y sincronización.'
author: 'Luis Ramírez Calle'
series: 'Estructuras de datos y algoritmos: elegir, resolver y medir'
tags: [estructuras-de-datos, hashing, map, typescript]
---

El catálogo se actualiza, pero la búsqueda sigue devolviendo el título antiguo. El índice permite encontrar una referencia enseguida; lo que no hace es saber que esa referencia ha dejado de representar el dato vigente.

Un índice por clave puede ahorrar recorridos repetidos. Para usarlo bien necesitamos entender dos cosas: cómo localiza candidatos y quién lo mantiene consistente con la colección de origen. Lo segundo no aparece en una tabla de Big O.

## Una función hash no identifica un objeto por sí sola

Una **hash table** calcula un hash de la clave y lo utiliza para localizar una zona de almacenamiento. Claves distintas pueden acabar en el mismo lugar: una **collision** es una situación prevista, no una excepción imposible.

En **separate chaining**, cada posición conduce a un grupo de entradas y se comprueba la igualdad de sus claves. En **open addressing**, se exploran otras posiciones siguiendo una regla. En ambos casos seguimos necesitando comparar la clave real para distinguir candidatos.

```text
hash(clave) -> bucket

bucket 0: (ID 12, documento A) -> (ID 37, documento B)
bucket 1: vacío
bucket 2: (ID 9, documento C)

Buscar 37: localizar bucket 0 y comprobar claves 12, 37.
```

La distribución, el número de entradas y la capacidad importan. La **load factor** relaciona entradas con capacidad. Cuando crece demasiado, una implementación puede ampliar la tabla y redistribuir entradas: **rehashing**. Esa operación cuesta trabajo aunque las consultas anteriores fueran baratas.

## Esperado O(1) no equivale a una promesa de un solo paso

Con una distribución adecuada y una carga controlada, las operaciones hash pueden tener coste esperado O(1). Un caso adverso con muchas colisiones puede necesitar recorrer muchas entradas. El análisis también debe considerar el coste de calcular hashes e igualar claves, especialmente con strings largos.

En **TypeScript**, `Map` es una abstracción del runtime. La especificación ECMAScript exige acceso promedio sublineal respecto al número de elementos; no obliga a usar una tabla hash concreta ni garantiza O(1) para cada llamada. No podemos deducir el número de instrucciones de `get` mirando su sintaxis.

Tampoco funciona como un árbol ordenado: el orden de iteración es el de inserción. Las claves objeto se comparan por identidad, no por igualdad profunda de sus propiedades. Nuestros ejemplos evitan esas diferencias trabajando con IDs enteros seguros no negativos.

## Construir el índice es una decisión de contrato

Archivo `algorithms.ts` del [laboratorio](/assets/examples/estructuras-algoritmos-lab.zip):

```typescript
export function buildIndex<T extends { readonly id: number }>(
  rows: readonly T[],
): Map<number, T> {
  const index = new Map<number, T>()
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id < 0) throw new RangeError('ID inválido')
    if (index.has(row.id)) throw new Error(`ID duplicado: ${row.id}`)
    index.set(row.id, row)
  }
  return index
}
```

Rechazamos duplicados porque el contrato considera único el ID. Usar directamente `set` conservaría la última entrada, mientras que nuestra [búsqueda lineal](/posts/busqueda-lineal-contrato-coste) devuelve la primera. No sería una optimización equivalente sobre esas entradas.

Otra aplicación podría guardar una lista por clave o sobrescribir deliberadamente. Lo importante es que esa política sea visible y esté probada. El constructor devuelve las mismas referencias, no copias ni objetos congelados.

## Un índice puede quedar obsoleto de dos maneras

Si reemplazas el catálogo por objetos nuevos y conservas el Map anterior, este sigue apuntando a los antiguos. Si modificas el `id` de un objeto ya indexado, su clave en el Map tampoco cambia sola. Ahora la clave del índice y la propiedad del objeto pueden contradecirse.

Una estrategia sencilla para catálogos pequeños es reconstruir colección e índice como una unidad y sustituir ambos juntos. Otra mantiene cada inserción, actualización y borrado en la misma operación lógica. Elegir una implica tener en cuenta frecuencia de cambios, memoria y lectores concurrentes.

La búsqueda rápida no compensa respuestas incorrectas. Por eso el test de actualización no pregunta cuánto tarda `get`; exige que, al sustituir el catálogo, una búsqueda devuelva el documento nuevo.

## Garantías y límites

No implementamos una tabla hash propia ni medimos colisiones internas del motor. Los tests cubren IDs inválidos, duplicados, ausencias, referencias y reconstrucción. El benchmark final distingue **Map preparado** de **construir y consultar**, y no presenta una llamada como «una operación de CPU».

## Ejercicio: escoger una política de duplicados

Recibe dos documentos con el mismo ID y distintos títulos. Escribe tres contratos posibles: rechazar, conservar el último y agrupar todos. Para cada uno, define el tipo devuelto por la consulta y una prueba. Después explica por qué no puedes compararlos como si fueran la misma búsqueda.

## Referencias

- [ECMAScript: requisitos de Map e igualdad de claves](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects).
- [Open Data Structures: chained hash tables](https://opendatastructures.org/ods-python/5_1_ChainedHashTable_Hashin.html).
