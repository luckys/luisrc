---
id: API-EVOLUTION
title: 'Evolucionar una API sin romper clientes: contratos y cursor pagination'
published: 2026-10-17T01:04:00Z
locale: es
translationKey: reliable-api-evolution
slug: evolucion-api-paginacion-contratos
draft: true
status: draft
level: intermedio
prerequisites: [API-ERRORS, DB-INDEX-DESIGN]
description: 'Identifica cambios incompatibles y diseña una paginación con orden estable. Un cursor evita ciertos saltos, pero no crea una instantánea.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [api, contratos, paginacion, postgresql]
---

La segunda página de pedidos repite el último elemento de la primera. Alguien insertó un pedido mientras el usuario navegaba y el desplazamiento ya no apunta a los mismos registros. El endpoint sigue devolviendo JSON válido; lo que ha cambiado es su significado.

Evolucionar un contrato exige pensar tanto en sus campos como en su comportamiento. Después de [validación y errores](/posts/validacion-errores-api-problem-details), veremos cómo mantener clientes existentes y recorrer datos que siguen cambiando.

## Un campo nuevo no siempre es un cambio inocente

Un cliente que selecciona `id` puede tolerar que aparezca `description`. Otro que rechaza cualquier propiedad desconocida podría fallar. La compatibilidad no se deduce mirando solamente el diff del servidor: depende de las expectativas de sus consumidores.

También son cambios incompatibles convertir un campo opcional en obligatorio, modificar la unidad de un importe o añadir un estado que un cliente considera imposible. Una nueva opción en un enum puede romper un `switch` exhaustivo aunque no desaparezca ninguna propiedad.

El test del laboratorio utiliza un consumidor pequeño que extrae `id` e ignora un campo nuevo. Demuestra esa tolerancia concreta, no la compatibilidad de todos los clientes posibles. Para una API real necesitaríamos ejemplos representativos y **contract tests** mantenidos junto a los consumidores.

## Un cursor necesita un orden total

Ordenar solo por fecha no basta: dos pedidos pueden compartirla. Elegimos el par `(created_at, id)` en orden ascendente. El identificador deshace los empates y el cursor conserva ambos valores.

<img src="/assets/visuals/reliable-services/API-EVOLUTION.svg" alt="El cursor conserva fecha e identificador del último pedido y la siguiente página empieza estrictamente después de ese par, incluidos los empates de fecha." width="580" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-EVOLUTION.svg).

Archivo: `servicios-fiables/src/service.ts` (extracto del modelo en memoria).

```typescript
export function pageAfter<T extends Row>(
  rows: T[],
  cursor: Row | undefined,
  limit: number,
): T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('invalid_limit')
  return rows
    .filter(
      (row) =>
        !cursor ||
        row.created_at > cursor.created_at ||
        (row.created_at === cursor.created_at && row.id > cursor.id),
    )
    .sort((a, b) =>
      a.created_at < b.created_at
        ? -1
        : a.created_at > b.created_at
          ? 1
          : a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0,
    )
    .slice(0, limit)
}
```

El ejemplo usa fechas ISO homogéneas e identificadores ASCII. No pretende simular todas las collations de PostgreSQL. En SQL, la condición equivalente compara el par y mantiene el mismo `ORDER BY`; el índice debe corresponder a ese acceso, como vimos en [índices compuestos](/posts/indices-compuestos-parciales-covering).

El fallo de ordenar únicamente por fecha se ve con dos filas del mismo día: un filtro «fecha mayor» saltaría una de ellas. El test exige que después de `a` llegue `b`, aunque ambas compartan fecha.

## Qué conserva el cursor y qué no

La **keyset pagination** permite continuar después de una clave sin contar todas las filas anteriores. Evita que ciertas inserciones anteriores desplacen el punto de continuación, pero no crea un snapshot entre peticiones.

Si cambia la columna de ordenación de un pedido, puede moverse de una página a otra. Si necesitas una exportación consistente, define una frontera temporal, un snapshot adecuado o un proceso de exportación separado. La técnica debe responder al requisito, no al revés.

Un cursor codificado en Base64 no está cifrado ni autorizado. Hay que validarlo, limitar el tamaño de página y aplicar los filtros de tenant y permisos en cada consulta. Firmarlo puede impedir manipulaciones, pero tampoco reemplaza esos filtros.

## Versionar cuando existe una incompatibilidad real

Puedes evolucionar un contrato mediante cambios compatibles, una etapa de deprecación o versiones explícitas en URL o headers. Una versión nueva permite convivir, pero obliga a mantener y retirar versiones antiguas con un criterio conocido.

Antes de crear `/v2`, escribe qué consumidor se rompe y cómo migrará. Para un cambio de representación, conviene que los dos formatos convivan durante una transición. No es razonable exigir que todos los clientes se desplieguen al mismo tiempo.

## Garantías y límites

El laboratorio prueba el orden compuesto y un consumidor tolerante. No contiene un benchmark de un millón de filas ni un sistema de cursores firmado. No atribuimos al ejemplo una mejora de latencia medida.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="cursor compuesto" tests/core.test.mjs
```

## Ejercicio: contrato de cambio

Añade tres pedidos con la misma fecha y páginas de tamaño uno. Cada identificador debe aparecer una sola vez. Después introduce un estado nuevo y escribe qué hará un cliente antiguo. Documenta la política antes de modificar su código.

La siguiente entrega introduce [identidad y autorización por recurso](/posts/autenticacion-autorizacion-tenant), que no deben desaparecer al paginar.

## Referencias

- [PostgreSQL 18: ordenación y LIMIT](https://www.postgresql.org/docs/18/queries-limit.html).
- [PostgreSQL 18: comparación de constructores de fila](https://www.postgresql.org/docs/18/functions-comparisons.html#ROW-WISE-COMPARISON).
- [OpenAPI 3.1.1: contratos de entrada y salida](https://spec.openapis.org/oas/v3.1.1.html).

Fuentes consultadas el 17 de octubre de 2026.
