---
id: PBT-FUZZ
title: 'Fuzzing de un parser: combinar bytes extraños con entradas que sí llegan al negocio'
published: 2026-10-22T09:04:00Z
locale: es
translationKey: property-testing-fuzzing
slug: fuzzing-parser-bytes-generadores-estructurados
draft: true
status: draft
level: intermedio
prerequisites: [P057, P022]
description: 'Prueba UTF-8, JSON y validación de campos con fuzzing acotado. Combina bytes arbitrarios y objetos válidos para que rechazar todo no parezca una implementación correcta.'
author: 'Luis Ramírez Calle'
series: 'Pruebas basadas en propiedades: encontrar y explicar contraejemplos'
tags: [testing, fuzzing, validation, fast-check]
---

Un parser rechaza mil entradas aleatorias y no lanza ninguna excepción. Podría estar funcionando bien. También podría devolver `null` para cualquier entrada, incluidas las válidas.

El ruido sirve para buscar fallos en la frontera, pero necesitamos otro generador que llegue al camino de aceptación. Si no lo hacemos, una prueba aparentemente exigente puede premiar una implementación que no procesa nada.

Aplicaremos [propiedades y generadores](/posts/property-based-testing-generadores-invariantes) a un parser de mensajes. Partimos de la distinción entre datos externos y tipos internos de [la serie de validación](/posts/validacion-runtime-json-schema-zod-pydantic). El laboratorio recibe bytes directamente, no peticiones HTTP.

## Qué llamamos fuzzing y qué estamos ejecutando

El **fuzzing** busca defectos suministrando muchas entradas variadas, a menudo malformadas. Hay motores que utilizan cobertura para decidir qué mutaciones explorar. No estamos ejecutando uno de esos motores.

Usamos **fast-check** para una campaña finita de generación de bytes y comprobación de propiedades. Conserva reducción y replay cuando un predicado falla, pero no instrumenta el parser para guiar la búsqueda por cobertura. Llamar «fuzzing» a esta prueba no la convierte en una auditoría de seguridad.

Nuestro mensaje admite un `id` como `payment-12` y un `amountMinor` entero entre uno y un millón. Ignora campos adicionales. El parser devuelve esos dos campos o `null` cuando la entrada no cumple el contrato.

<img src="/assets/visuals/property-testing/PBT-FUZZ.svg" alt="Una campaña de mil arrays de bytes prueba el límite de tamaño, UTF-8 y JSON; otra de trescientos objetos válidos alcanza la aceptación y compara campos exactos, sin afirmar fuzzing guiado por cobertura o seguridad HTTP." width="335" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/property-testing/PBT-FUZZ.svg).

## Separar bytes, sintaxis y significado

Archivo `src/parser.ts`, con `amountMinor` importado de `./money.ts`. `ParsedPayment` describe el resultado interno `{ id: string; amountMinor: number }`:

```typescript
export function parsePayment(bytes: Uint8Array): ParsedPayment | null {
  if (bytes.byteLength > 256) return null
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return null
    throw error
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  if (typeof value.id !== 'string' || !/^payment-[0-9]{1,3}$/.test(value.id)) return null
  try { return { id: value.id, amountMinor: amountMinor(value.amountMinor) } }
  catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}
```

Primero rechazamos buffers mayores de 256 bytes. Después, `TextDecoder` con `fatal: true` rechaza UTF-8 inválido en lugar de sustituirlo silenciosamente. `JSON.parse` se ocupa de la sintaxis, no de las reglas del importe.

El valor sigue siendo `unknown` hasta comprobar su forma. `null` necesita una comprobación expresa porque `typeof null` es `object`; los arrays tampoco son el mensaje esperado.

La conversión a `Record<string, unknown>` permite examinar campos después de verificar que tenemos un objeto. No afirma que ya sea un pago válido. `amountMinor` sigue haciendo la validación numérica en ejecución.

Solo transformamos errores previstos en rechazo. Un error de programación inesperado debe propagarse y hacer fallar el test. Un `catch` que devolviera siempre `null` podría esconder precisamente el defecto que queremos encontrar.

## Bytes arbitrarios comprueban una frontera, no todo el contrato

La primera propiedad genera **mil arrays de hasta trescientos bytes** con seed `5704`. Las entradas que superan 256 deben rechazarse. Para cualquier resultado aceptado comprobamos formato del ID, importe entero dentro del rango y round-trip: serializarlo a JSON y volver a leerlo conserva los dos campos.

Si `parsePayment` lanza una excepción inesperada, la propiedad falla. No la capturamos en el predicado para seguir contando casos verdes.

Es probable que gran parte del ruido ni siquiera sea JSON. Eso es útil para la frontera de decodificación, pero no es evidencia suficiente sobre todas las combinaciones de campos. Un rechazo temprano no recorre las validaciones posteriores.

## El generador estructurado impide que rechazar todo pase

La segunda propiedad genera trescientos mensajes válidos con seed `5705`. Extracto de `tests/boundaries.test.mjs`:

```javascript
  fc.assert(fc.property(fc.record({
    id: fc.integer({ min: 0, max: 999 }).map((id) => `payment-${id}`),
    amountMinor: fc.integer({ min: 1, max: 1_000_000 }),
  }), (input) => {
    assert.deepEqual(parsePayment(Buffer.from(JSON.stringify(input))), {
      id: input.id, amountMinor: input.amountMinor,
    })
  }), { seed: 5705, numRuns: 300 })
```

Estos mensajes caben en el límite y satisfacen los campos requeridos. Un parser que devolviera siempre `null` fallaría aquí. Ambos generadores responden preguntas distintas; añadir más ruido no sustituye esta comprobación.

Al ejecutar la primera versión del test apareció un fallo del propio oráculo: comparaba directamente el resultado con el objeto generado. fast-check puede producir records con prototipo nulo y la comparación estricta distinguía prototipos, aunque los campos fueran iguales.

El contrato es JSON, que no transporta prototipos. Corregimos la expectativa construyendo un objeto ordinario con los campos esperados. No cambiamos el parser para satisfacer un detalle de representación que no pertenecía a su contrato.

## Casos explícitos para los rechazos que nos importan

La suite conserva ejemplos de `null`, arrays, objetos vacíos, JSON incompleto, importe cero, un string numérico e `1e309`. Este último termina fuera de nuestro dominio numérico y debe rechazarse.

También hay un buffer con los bytes `0xc3, 0x28`, que no forman UTF-8 válido, y otro de 257 bytes. Son regresiones legibles: no dependen de que una campaña aleatoria vuelva a encontrar esas formas.

Podríamos ampliar el generador con mensajes casi válidos que alteren un único campo. Es una extensión útil, pero no describimos como ejecutado un corpus que todavía no existe en la suite.

## Código completo y pruebas

[Índice del artículo](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/pbt-fuzz/README.md) y [parser y validación](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/property-testing/src/parser.ts).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/property-testing test
```

## Garantías y límites

La campaña de bytes y la de mensajes válidos pasan junto a los ejemplos de rechazo. No utilizamos fuzzing guiado por cobertura, procesos nativos instrumentados o una campaña indefinida. Tampoco comprobamos límites de memoria o CPU mediante una prueba de carga.

El límite se aplica cuando el buffer ya existe: no evita que un servidor HTTP lea un body enorme antes de llamar al parser. Haría falta un límite durante la recepción. Tampoco rechazamos claves JSON duplicadas: rige el comportamiento de `JSON.parse`, que conserva la última. Si el protocolo lo prohibiera, necesitaríamos otro control y sus pruebas.

## Ejercicio: comprobar el contrato de campos adicionales

Añade `label` al mensaje de entrada y decide si debe ignorarse o rechazarse. La implementación actual lo ignora y no lo devuelve. Escribe una expectativa explícita antes de cambiar esa política; no permitas que el generador decida por accidente qué compatibilidad necesita tu API.

Ahora pasamos de entradas extrañas a fallos entre pasos: [perder la respuesta sin repetir el efecto](/posts/fault-injection-respuesta-perdida-propiedades).

## Referencias

- [fast-check: uso para fuzzing](https://fast-check.dev/docs/advanced/fuzzing/).
- [Node.js 24: TextDecoder y decodificación fatal](https://nodejs.org/docs/latest-v24.x/api/util.html#class-utiltextdecoder).

Fuentes consultadas el 22 de octubre de 2026. Campañas finitas ejecutadas con fast-check 4.10.2.
