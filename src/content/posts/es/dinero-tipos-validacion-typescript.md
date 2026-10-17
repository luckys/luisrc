---
id: API-MONEY
title: 'Dinero en TypeScript: cantidades exactas y límites de confianza'
published: 2026-10-17T01:00:00Z
locale: es
translationKey: reliable-money-types
slug: dinero-tipos-validacion-typescript
draft: true
status: draft
level: intermedio
prerequisites: [DB-MODEL]
description: 'Representa dinero sin decimales binarios, valida datos externos y distingue lo que comprueba TypeScript de las reglas que necesita el negocio.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [typescript, backend, dinero, validacion]
---

Un importe puede superar las pruebas de tipos y seguir siendo imposible para tu aplicación. `number` acepta una cantidad negativa, `NaN` y un decimal donde esperabas céntimos. Ninguno deja de ser un número por estar mal para el negocio.

Antes de diseñar endpoints conviene decidir qué datos puede representar el programa. Esta primera entrega de **APIs y seguridad sin atajos** continúa los [fundamentos de bases de datos](/posts/modelado-relacional-integridad-datos): protegeremos en TypeScript una regla que después también deberá proteger PostgreSQL.

Al terminar podrás justificar una representación monetaria, validar una entrada `unknown` y explicar por qué un tipo estático no sustituye ese control.

## Un importe necesita cantidad, unidad y moneda

Usaremos una tienda que solo acepta **EUR**. `amount_minor: 1200` significa 1200 céntimos, es decir, 12 euros. Elegimos unidades menores enteras para sumar y comparar sin introducir decimales binarios en esas operaciones.

Esto no significa que todos los problemas monetarios se resuelvan con enteros. Un reparto de 100 céntimos entre tres personas exige decidir quién recibe el céntimo restante. Un impuesto calculado como proporción requiere una política de redondeo. Representación y reglas de cálculo son decisiones diferentes.

Tampoco todas las monedas tienen dos decimales. Restringir el ejemplo a EUR permite explicar el mecanismo sin esconder un catálogo de monedas y excepciones dentro del tutorial.

<img src="/assets/visuals/reliable-services/API-MONEY.svg" alt="Un JSON no confiable atraviesa validación de cantidad y moneda antes de convertirse en Money; la base de datos mantiene sus propias constraints." width="548" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-MONEY.svg).

## Por qué 0.1 más 0.2 no es una estrategia contable

Los valores `0.1` y `0.2` no tienen una representación binaria finita exacta en el formato que utiliza `number`. La suma puede mostrar una pequeña diferencia respecto a `0.3`. No es un error particular de TypeScript ni desaparece al cambiar de framework.

El laboratorio empieza reproduciendo esa diferencia. La corrección no consiste en repartir `toFixed(2)` por la aplicación: ese método produce texto formateado y no define cuándo redondear cada operación de negocio.

Otra alternativa es utilizar una biblioteca decimal con precisión y redondeo explícitos. Puede ser preferible para cálculos financieros complejos. Aquí no la necesitamos: el caso de uso recibe un total ya expresado en céntimos.

## Validar la frontera y crear un valor pequeño

Archivo: `servicios-fiables/src/money.ts` (extracto; implementación completa en el laboratorio).

```typescript
export type Money = Readonly<{ amount_minor: number; currency: 'EUR' }>

export function parseMoney(value: unknown): Money {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid_money')
  }
  const input = value as Record<string, unknown>
  if (!Number.isSafeInteger(input.amount_minor) || (input.amount_minor as number) <= 0) {
    throw new Error('invalid_amount')
  }
  if (input.currency !== 'EUR') throw new Error('unsupported_currency')
  return Object.freeze({ amount_minor: input.amount_minor as number, currency: 'EUR' })
}
```

`unknown` obliga a comprobar la entrada antes de usarla. La aserción a `Record` solo permite inspeccionar propiedades después de comprobar el objeto; no declara que sus valores sean válidos.

**`Number.isSafeInteger`** rechaza decimales y cantidades fuera del rango entero seguro de `number`. El rango de PostgreSQL `bigint` es mayor, por lo que no debemos convertir arbitrariamente cualquier `bigint` de la DB a `number`. Para importes superiores habría que elegir otra representación de extremo a extremo, por ejemplo un entero serializado como string.

`Readonly` impide ciertas modificaciones durante el análisis estático. **`Object.freeze`** añade protección en ejecución sobre este objeto plano. Ninguno demuestra que la cantidad coincida con el precio de un pedido: esa comparación pertenece a otra regla.

## Probar también lo que debe rechazarse

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip), descomprímelo y entra en `servicios-fiables/`. Necesitas **Node.js 24**. Las pruebas del núcleo no requieren instalar paquetes.

Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="money" tests/core.test.mjs
```

La prueba acepta 30 céntimos y rechaza `null`, un objeto vacío, 1.5 céntimos, una moneda no soportada y un entero fuera de rango. Primero se escribieron las aserciones; después se añadió la implementación. El test conserva el contraejemplo decimal para que la decisión siga teniendo una razón observable.

## Garantías y límites

El constructor valida la representación elegida, no el origen del dinero ni los permisos de quien lo envía. Un cliente no debe fijar por sí solo el precio final de un producto. La aplicación tendrá que consultar precios autorizados y aplicar descuentos según sus reglas.

**TypeScript** no valida el JSON recibido al ejecutar el programa. Node.js puede borrar los tipos al cargar estos archivos; eso tampoco equivale a ejecutar `tsc`. El laboratorio separa ejecución, comprobación estática y validación runtime.

## Ejercicio: repartir sin perder céntimos

Implementa un reparto de 100 céntimos entre tres destinatarios con un orden estable. Debe devolver 34, 33 y 33, conservar la suma y no producir decimales. Define qué ocurre si la cantidad es menor que el número de destinatarios. No cambies la representación para ocultar el problema.

La siguiente entrega aborda otra confusión frecuente: [por qué un solo hilo también puede sufrir race conditions](/posts/asincronia-nodejs-carreras-concurrencia).

## Referencias

- [TypeScript: narrowing y comprobaciones de tipos](https://www.typescriptlang.org/docs/handbook/2/narrowing.html).
- [Node.js 24: ejecución de TypeScript y límites del type stripping](https://nodejs.org/docs/latest-v24.x/api/typescript.html).
- [ECMAScript: Number.isSafeInteger](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.issafeinteger).

Documentación consultada el 17 de octubre de 2026. Laboratorio ejecutado con Node.js 24.19.0.
