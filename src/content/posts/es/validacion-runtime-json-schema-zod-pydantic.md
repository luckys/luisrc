---
id: P022
title: 'Validar una API: del JSON correcto a una operación que tiene sentido'
published: 2026-10-18T04:02:00Z
locale: es
translationKey: api-runtime-validation-schemas
slug: validacion-runtime-json-schema-zod-pydantic
draft: true
status: draft
level: intermedio
prerequisites: [P021]
description: 'Separa parsing, schemas y reglas de negocio con JSON Schema, Zod y Pydantic. Ejemplos probados, errores por campo y límites de compatibilidad.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, validacion, json-schema, zod, pydantic, typescript, python]
---

Una solicitud pide reservar dos unidades, pero envía `quantity: "2"`. Otra envía un entero correcto cuando solo queda una unidad. Ambas pueden fallar, aunque por motivos distintos: la primera incumple el contrato de entrada; la segunda no puede ejecutarse con el stock actual.

Si tratamos todo como «datos inválidos», el cliente no sabrá qué corregir y el servidor mezclará comprobaciones que necesitan garantías diferentes. Un formulario puede comprobar un entero. No puede prometer que seguirá habiendo stock cuando llegue la solicitud.

Después de [elegir recursos y métodos HTTP](/posts/recursos-http-metodos-idempotencia), vamos a separar esas decisiones con una reserva ficticia. El objetivo es entender las fronteras, no comparar tres bibliotecas para decidir cuál gana.

## Parsing, validación semántica y negocio responden preguntas distintas

El **parsing** convierte bytes en una estructura. `{"quantity":` ni siquiera es JSON completo. Nuestro servidor devuelve **400** antes de intentar validar campos. También exige UTF-8 válido, un tipo de contenido admitido y un cuerpo de como máximo 4.096 bytes.

La **validación estructural y semántica de entrada** comprueba el documento contra el contrato: objeto, propiedades admitidas, tipos, límites y relaciones entre campos. Un entero negativo es JSON perfectamente válido, pero no una cantidad de reserva válida. Elegimos **422** para estas restricciones incumplidas.

Las **reglas de negocio** consultan el estado: ¿existe el producto?, ¿queda stock?, ¿trabajamos sobre la versión que el cliente vio? Una cantidad positiva no responde a ninguna de ellas. Además, comprobar stock y escribir más tarde sin proteger el intervalo puede vender la misma unidad dos veces.

La autorización es otra frontera: tener una solicitud bien formada no permite reservar en nombre de cualquier identidad. No está implementada en este laboratorio y la desarrollaremos por separado.

<img src="/assets/visuals/api-contracts/P022.svg" alt="Los bytes pasan por UTF-8 y parsing, luego por el schema de entrada, después por stock y versión del inventario y finalmente por el DTO de salida. Cada frontera tiene fallos diferentes." width="338" height="1379" loading="lazy" style="width:100%;height:auto" />

[Ampliar las fronteras de validación](/assets/visuals/api-contracts/P022.svg).

## El contrato de reserva debe decidir qué acepta, no adivinarlo

Nuestro comando tiene cinco campos:

| Campo             | Restricción del ejemplo                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| `sku`             | Entre 1 y 24 caracteres ASCII: empieza por A–Z y continúa con A–Z, dígitos o guion. |
| `quantity`        | Entero entre 1 y 100.                                                               |
| `expectedVersion` | Entero entre 1 y 1.000.000; expresa la versión que espera el cliente.               |
| `priority`        | `standard` o `express`.                                                             |
| `note`            | Opcional; string de hasta 80 code points Unicode. No admite `null`.                 |

Para `express` fijamos un máximo de cinco unidades. Es una política didáctica estable que depende solo de la solicitud. Podría cambiar por una decisión comercial, pero no requiere consultar inventario. Por eso podemos expresarla como una restricción entre campos.

En cambio, «hay suficientes unidades ahora» necesita estado compartido y no pertenece a ese schema. Convertir una consulta de stock en un refinement asíncrono no hace atómica la reserva posterior.

Rechazamos campos desconocidos. Si llega `stock: 100`, no lo copiamos al inventario ni lo ignoramos sin avisar. Esta decisión ayuda a detectar errores y evita aceptar accidentalmente propiedades que el cliente no controla. No sustituye permisos ni una construcción explícita del objeto interno.

## JSON Schema describe datos; OpenAPI sitúa ese schema en una operación

**JSON Schema 2020-12** permite expresar tipos, propiedades requeridas y restricciones. `required` decide si una propiedad debe existir; el tipo decide qué valores admite. Una propiedad ausente y una propiedad con `null` no son lo mismo.

El archivo completo `reservation.schema.json` contiene también `additionalProperties: false`. Para la restricción de prioridad utiliza este fragmento:

```json
{
  "if": {
    "properties": { "priority": { "const": "express" } },
    "required": ["priority"]
  },
  "then": {
    "properties": {
      "quantity": { "type": "integer", "maximum": 5 }
    }
  }
}
```

El `required` dentro de `if` importa: comprobar una propiedad con `properties` no exige por sí solo su presencia. El schema raíz exige los cuatro campos obligatorios; el condicional expresa cuándo aplica el límite adicional.

**OpenAPI 3.1.1**, la versión utilizada en la entrega anterior, puede referenciar este documento desde el schema de un `requestBody` JSON. OpenAPI describe dónde se usa la entrada; no ejecuta la validación por aparecer en el repositorio. Aquí la comprobamos con **Ajv 8.20.0**, en modo estricto y con `allErrors: true`.

No hemos añadido otro documento OpenAPI completo al laboratorio nuevo. Conservamos el [contrato HTTP anterior](/posts/api-contrato-esquema-clientes) y probamos el schema independiente de esta operación. Esa separación evita presentar una especificación no escrita como si ya existiera.

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

## Pydantic necesita decisiones equivalentes, no una traducción línea a línea

En **Python**, las anotaciones tampoco validan por sí solas los datos externos. **Pydantic** sí ejecuta comprobaciones al construir o validar un modelo. Archivo `validation.py`, extracto probado con **Pydantic 2.13.5**:

```python
class ReservationInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    sku: str
    quantity: int = Field(ge=1, le=100)
    expectedVersion: int = Field(ge=1, le=1_000_000)
    priority: Literal["standard", "express"]
    note: str = Field(default="", max_length=80)
```

El archivo completo incluye imports, validación del SKU y un `model_validator` para el límite express. `strict=True` evita conversiones generales como pasar de string a entero; `extra="forbid"` rechaza campos desconocidos.

Hay un detalle importante: JSON Schema considera entero un número sin parte fraccionaria, como `2.0`. Al cargar JSON en Python, ese literal puede convertirse en `float`, mientras que JavaScript no conserva esa distinción de representación. El modelo incluye un validador previo que convierte únicamente floats integrales a int. Los límites se comprueban después; no convierte strings ni booleanos.

También evita confundir opcional con nullable. `note` tiene un default interno vacío, pero `null` sigue siendo inválido. Para comparar con el comando original usamos `model_dump(exclude_unset=True)`, que no añade el campo omitido. No queremos que un detalle del modelo cambie silenciosamente el contrato de transporte.

Veinte documentos compartidos pasan por Ajv, Zod y Pydantic. Incluyen ausencia, `null`, booleanos, strings, fracciones, campos extra y la regla express. Otras pruebas cubren 80 y 81 emoji. Esto demuestra acuerdo en esos casos, no equivalencia universal entre bibliotecas o dialectos.

## Acumular errores ayuda al cliente, pero no obliga a ejecutar todas las reglas

Si SKU, cantidad o prioridad fallan de manera independiente, devolver varios errores evita un ciclo de corregir uno y descubrir el siguiente. En nuestro contrato de reserva proyectamos los issues a una lista propia de `{ pointer, code }`, con **JSON Pointer** para ubicar el campo.

No enviamos los objetos nativos de Zod ni de Pydantic: pueden contener valores recibidos, nombres arbitrarios, mensajes internos y formatos que cambian con una dependencia. Un campo desconocido se señala con el pointer vacío, que identifica el documento raíz, sin reflejar su nombre.

Acumular no significa que cualquier regla deba ejecutarse con datos mal formados. Si falta un entero, una regla entre campos puede no tener valores seguros sobre los que operar. Pydantic también puede ubicar un error de modelo en la raíz, mientras que nuestro refinement de Zod lo asigna a cantidad. La adaptación pública debe ser explícita si usamos distintos backends.

El cliente tampoco debería depender del orden nativo de los issues. Publicamos códigos propios y deduplicamos por campo. Los mensajes comprensibles para cada regla serían una ampliación del catálogo, no algo que debamos extraer analizando textos de una biblioteca.

## Validar la salida detecta errores del servidor, no errores del usuario

Después de reservar construimos un DTO con `sku`, `reserved` y `version`. Otro schema de Zod verifica esa representación y rechaza propiedades internas. Es distinto de serializar todo el registro de inventario.

Si falla, devolvemos **500**, no 422: el usuario no puede corregir una salida que construyó el servidor. Pero esa validación ocurre después de modificar el Map. Detectar un fallo no revierte la operación, igual que perder la respuesta no demuestra que la reserva no ocurriera.

Por eso no recomendamos reintentar un POST automáticamente ante cualquier 500. La [siguiente entrega sobre errores](/posts/errores-api-problem-details-stock-concurrencia) explica cómo distinguir causas sin prometer más de lo que sabemos.

## Compatibilidad también significa revisar lo que dejas de aceptar

Hacer obligatorio un campo antes opcional rompe clientes que lo omiten. Reducir un máximo rechaza entradas antes válidas. Añadir un valor a un enum puede afectar a consumidores que solo contemplan los anteriores, sobre todo en respuestas.

Incluso añadir una propiedad puede fallar si el receptor rechaza desconocidos. Una política estricta de entrada puede ser razonable, pero obliga a coordinar despliegues y cambios. No existe compatibilidad garantizada por el simple hecho de que siga siendo JSON.

Compartir un schema reduce duplicación dentro de un sistema. Entre lenguajes seguimos necesitando pruebas de contrato: defaults, regex, precisión y conversiones pueden diferir. No usamos el resultado de generar un tipo como sustituto de ejecutar esas pruebas.

## Garantías y límites

El [laboratorio descargable](/assets/examples/api-validacion-errores-lab.zip) incluye schemas, fixtures, servidor y tests. Desde su directorio:

```bash
pnpm install --frozen-lockfile
pnpm test
node server.mjs
```

El README contiene la ejecución aislada de Python con la imagen local y las versiones fijadas. No instala Python automáticamente. Se han ejecutado las pruebas de los tres validadores; Pydantic no sirve un segundo endpoint HTTP en esta entrega.

No hay autenticación, base de datos ni pagos. El stock vive en un solo proceso. Consumir y descartar cuerpos excesivos no es protección completa contra abuso o slow clients. El schema tampoco sustituye constraints, transacciones o permisos.

## Ejercicio: introducir una opción sin aceptar null accidentalmente

Añade `reference`, opcional y de hasta 30 code points, sin admitir `null`. Amplía JSON Schema, Zod, Pydantic y los casos compartidos. Prueba omisión, string vacío, límite, exceso y un cliente antiguo que no conoce el campo. Después decide si realmente debe ser obligatorio y explica a quién rompería el cambio.

## Referencias

- [JSON Schema: propiedades, required y additionalProperties](https://json-schema.org/understanding-json-schema/reference/object).
- [JSON Schema: condicionales](https://json-schema.org/understanding-json-schema/reference/conditionals).
- [OpenAPI 3.1.1: Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object).
- [Ajv: soporte de JSON Schema](https://ajv.js.org/json-schema.html).
- [Zod: safeParse y tipos inferidos](https://zod.dev/basics), [API y refinements](https://zod.dev/api).
- [Pydantic: strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/) y [validators](https://docs.pydantic.dev/latest/concepts/validators/).

Fuentes consultadas el 18 de octubre de 2026. Versiones fijadas para este laboratorio, no promesa de equivalencia entre todas sus opciones.
