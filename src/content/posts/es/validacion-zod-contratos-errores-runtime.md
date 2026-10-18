---
id: API-VALIDATION-ZOD
title: 'Validación con Zod: del dato desconocido a un comando comprobado'
published: 2026-10-18T04:03:00Z
locale: es
translationKey: validacion-zod-contratos-errores-runtime
slug: validacion-zod-contratos-errores-runtime
draft: true
status: draft
level: intermedio
prerequisites: [P022]
description: 'Implementa el contrato de reserva con Zod: safeParse, refinements, errores públicos y validación de salida con pruebas de frontera.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, zod, typescript, validacion, testing]
---

Un body llega con `quantity: "2"` y el código lo afirma como `Reservation`. El editor deja de quejarse, pero la afirmación no ha comprobado el dato ni lo ha convertido en entero. La frontera sigue recibiendo información que no controla.

**Zod** permite ejecutar el [contrato definido antes](/posts/validacion-runtime-json-schema-zod-pydantic) sobre ese valor. Vamos a seguir el comando desde la comprobación hasta los errores por campo y la respuesta del servidor, sin mezclar esta implementación con la alternativa Python.

## Zod valida en runtime; un tipo TypeScript no lo hace

Un `type` de **TypeScript** ayuda al compilador a comprobar código, pero no verifica por sí solo el body recibido. Una afirmación `as Reservation` tampoco convierte un string en un entero ni rechaza propiedades inesperadas.

**Zod** permite describir el contrato y ejecutarlo sobre un valor desconocido. Este es el schema de `validation.mjs`, probado con **Zod 4.6.7**:

```javascript
export const ReservationInput = z
  .strictObject({
    sku: z.string().regex(/^[A-Z][A-Z0-9-]{0,23}$/),
    quantity: z.number().int().min(1).max(100),
    expectedVersion: z.number().int().min(1).max(1000000),
    priority: z.enum(['standard', 'express']),
    note: z
      .string()
      .refine((value) => [...value].length <= 80)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.priority === 'express' && value.quantity > 5) {
      context.addIssue({ code: 'custom', path: ['quantity'], message: 'express_limit' })
    }
  })
```

El módulo importa `z` desde `zod`. Está escrito en JavaScript para ejecutar el mismo archivo directamente con Node, sin una compilación adicional. Zod también permite inferir tipos en TypeScript; aquí nos interesa la comprobación **runtime**, que existe en ambos casos.

`strictObject` rechaza propiedades desconocidas. `optional()` permite omisión, no `null`. El refinement cuenta code points para alinear el límite con JSON Schema, no unidades UTF-16 ni símbolos visuales completos. La expresión del SKU limita deliberadamente el identificador a un alfabeto ASCII; no es una validación de nombres escritos por personas.

`safeParse` devuelve un resultado explícito: éxito con datos o fallo con issues. No usamos coerción: `"2"` sigue siendo inválido. Si un formulario necesita convertir texto, esa conversión debe tener una política deliberada antes de construir el comando.

## Leer el schema como una secuencia de decisiones

`quantity` necesita ser número, entero y estar entre 1 y 100. Ninguna de esas condiciones implica las otras: 1,5 es número pero no entero; cero es entero pero no una cantidad aceptada. Separarlas permite elegir pruebas que fallen por motivos distintos.

`note` utiliza `optional()` para admitir que la propiedad no exista. El string vacío pasa porque no hemos impuesto un mínimo. `null` no pasa: es otro valor, no una forma alternativa de omitir el campo. La política puede cambiar, pero hacerlo debe ser una decisión del contrato.

La regla express relaciona dos campos que ya tienen significado. `superRefine` señala `quantity` cuando la prioridad es express y la cantidad supera cinco. Añadir un issue en ese path permite ubicar el problema cerca del dato que el usuario puede corregir.

No consultamos el stock desde el refinement. Aunque la biblioteca pudiera ejecutar una comprobación asíncrona, comprobar disponibilidad no reservaría las unidades. Esa decisión pertenece al caso de uso y debe protegerse junto a la escritura.

<img src="/assets/visuals/api-contracts/API-VALIDATION-ZOD.svg" alt="Un valor desconocido entra a safeParse; el éxito produce datos comprobados y el fallo issues que se proyectan a errores públicos sin copiar los valores." width="429" height="780" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-VALIDATION-ZOD.svg).

## safeParse separa un rechazo esperado de una excepción inesperada

El servidor de `server.mjs` integra el schema con estas tres líneas, ejecutadas en los tests HTTP:

```javascript
const result = ReservationInput.safeParse(await readJSON(request))
if (!result.success) throw new ApiError('invalid_input', fieldErrors(result.error))
body = ReservationOutput.parse(reserve(inventory, result.data))
```

El parsing del JSON ocurre antes. Solo si `result.success` es verdadero enviamos `result.data` al servicio. No seguimos utilizando el body original tras afirmar que «ya está validado», porque el resultado del parser es la frontera que hemos elegido.

El rechazo de entrada se transforma en `invalid_input`; no se trata como un bug del servidor. La última línea valida una representación que construye nuestro código: si falla, la responsabilidad sí está en el servidor. La [entrega de errores](/posts/errores-api-problem-details-stock-concurrencia) desarrolla esa traducción a HTTP.

## Acumular errores ayuda al cliente, pero no obliga a ejecutar todas las reglas

Si SKU, cantidad o prioridad fallan de manera independiente, devolver varios errores evita un ciclo de corregir uno y descubrir el siguiente. En nuestro contrato de reserva proyectamos los issues a una lista propia de `{ pointer, code }`, con **JSON Pointer** para ubicar el campo.

No enviamos los objetos nativos de Zod ni de Pydantic: pueden contener valores recibidos, nombres arbitrarios, mensajes internos y formatos que cambian con una dependencia. Un campo desconocido se señala con el pointer vacío, que identifica el documento raíz, sin reflejar su nombre.

Acumular no significa que cualquier regla deba ejecutarse con datos mal formados. Si falta un entero, una regla entre campos puede no tener valores seguros sobre los que operar. La proyección debe decidir dónde ubicar cada fallo sin depender de mensajes que puedan cambiar entre versiones.

El cliente tampoco debería depender del orden nativo de los issues. Publicamos códigos propios y deduplicamos por campo. Los mensajes comprensibles para cada regla serían una ampliación del catálogo, no algo que debamos extraer analizando textos de una biblioteca.

## El error público necesita una proyección pequeña

El contrato no expone los issues completos. Publica un pointer y un código propio por campo, deduplicados. Los nombres desconocidos se señalan en la raíz, no se reflejan tal como llegaron. Así evitamos devolver datos arbitrarios dentro de un mensaje generado por la biblioteca.

El test de errores múltiples envía SKU inválido, cantidad cero, versión como string, prioridad desconocida y una propiedad extra. Exige cinco referencias de error, sin valores ni nombres arbitrarios. Un segundo caso prueba expresamente que el límite express se sitúa en `/quantity`.

El cliente puede usar esos pointers para destacar controles, pero no debería inferir que el orden de la lista es una prioridad de negocio. Tampoco recibe mensajes específicos para cada regla en este ejemplo: añadirlos requeriría diseñar y probar otro catálogo, no exportar mensajes internos.

## Validar la salida detecta errores del servidor, no errores del usuario

Después de reservar construimos un DTO con `sku`, `reserved` y `version`. Otro schema de Zod verifica esa representación y rechaza propiedades internas. Es distinto de serializar todo el registro de inventario.

Si falla, devolvemos **500**, no 422: el usuario no puede corregir una salida que construyó el servidor. Pero esa validación ocurre después de modificar el Map. Detectar un fallo no revierte la operación, igual que perder la respuesta no demuestra que la reserva no ocurriera.

Por eso no recomendamos reintentar un POST automáticamente ante cualquier 500. La [siguiente entrega sobre errores](/posts/errores-api-problem-details-stock-concurrencia) explica cómo distinguir causas sin prometer más de lo que sabemos.

## Garantías y límites

El [ZIP de validación](/assets/examples/api-validacion-errores-lab.zip) fija Zod 4.6.7. El archivo del schema es JavaScript para poder ejecutar el mismo código con Node; la validación runtime existe también al usarlo desde TypeScript.

```bash
pnpm install --frozen-lockfile
node --test tests/validation.test.mjs tests/http.test.mjs
```

Los tests cubren tipos, límites, campos extra, Unicode, reglas entre campos, DTO de salida y proyección segura. No son una auditoría completa de seguridad. El servicio usa un Map de un proceso; validar no aporta autenticación, persistencia o rollback.

La implementación Python es una [lectura alternativa](/posts/validacion-pydantic-strict-null-refinements). No hace falta recorrerla para seguir con los errores de API.

## Ejercicio: distinguir tres decisiones sobre un campo

Antes de añadir código, escribe qué debe pasar con `note` ausente, `note: null` y `note: ""`. Haz fallar un test para la decisión que quieras cambiar y modifica solo esa restricción. Después contrasta el cambio con JSON Schema para no mantener dos contratos distintos sin saberlo.

## Referencias

- [Zod: resultados de safeParse](https://zod.dev/basics).
- [Zod: schemas, optional y refinements](https://zod.dev/api).
- [JSON Schema: objetos y propiedades](https://json-schema.org/understanding-json-schema/reference/object).

Versiones del laboratorio fijadas y fuentes consultadas el 18 de octubre de 2026.
