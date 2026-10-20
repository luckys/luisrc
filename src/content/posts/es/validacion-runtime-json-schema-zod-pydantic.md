---
id: P022
title: 'Validación de APIs: separar parsing, JSON Schema y reglas de negocio'
published: 2026-10-18T04:02:00Z
locale: es
translationKey: api-runtime-validation-schemas
slug: validacion-runtime-json-schema-zod-pydantic
draft: true
status: draft
level: intermedio
prerequisites: [P021]
description: 'Define qué valida un schema y qué requiere estado de negocio. JSON Schema, optional frente a null y casos de contrato probados.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, validacion, json-schema, openapi]
---

Una solicitud pide reservar dos unidades, pero envía `quantity: "2"`. Otra envía un entero correcto cuando solo queda una unidad. Las dos pueden fallar, aunque la primera incumple el contrato y la segunda no puede ejecutarse con el stock actual.

Si llamamos «validación» a cualquier comprobación, acabamos mezclando decisiones que necesitan garantías diferentes. Primero vamos a diseñar el contrato de entrada; después lo implementaremos con [Zod](/posts/validacion-zod-contratos-errores-runtime) o, como alternativa en Python, con [Pydantic](/posts/validacion-pydantic-strict-null-refinements).

Esta entrega continúa [recursos y métodos HTTP](/posts/recursos-http-metodos-idempotencia). Nos centramos en qué queremos aceptar y por qué, antes de elegir cómo ejecutaremos esas comprobaciones.

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

## Probar el contrato con casos que cambian una sola decisión

El laboratorio comparte veinte documentos en `cases.json`. Hay un comando válido y variaciones que cambian un campo cada vez: string donde esperamos un número, booleano, fracción, cero, máximo excedido, propiedad ausente, `null`, campo extra y prioridad express con seis unidades.

El propósito no es acumular ejemplos al azar. Si el caso válido pasa y cambiar solo cantidad a `"2"` lo hace fallar, podemos atribuir la diferencia al tipo. Si modificamos cuatro campos a la vez, un rechazo no demuestra que las cuatro reglas funcionen.

La regla express merece dos bordes: cinco unidades pasan y seis no. También comprobamos que `2.0` es un entero matemático para JSON Schema y que `true` no lo es. Esa diferencia se vuelve importante cuando cargamos el mismo JSON en otros lenguajes.

Para `note` añadimos pruebas con 80 y 81 emoji. El límite mide code points Unicode, no bytes del body, unidades UTF-16 o símbolos visuales completos. El límite de transporte de 4.096 bytes y el límite de una propiedad resuelven problemas distintos.

Ajv ejecuta el schema sin convertir strings, insertar defaults o eliminar propiedades para que pasen. Queremos comprobar el documento recibido y detectar decisiones que difieran de las implementaciones de Zod o Pydantic. La comparación en esos casos no prueba equivalencia universal entre bibliotecas.

## Compatibilidad también significa revisar lo que dejas de aceptar

Hacer obligatorio un campo antes opcional rompe clientes que lo omiten. Reducir un máximo rechaza entradas antes válidas. Añadir un valor a un enum puede afectar a consumidores que solo contemplan los anteriores, sobre todo en respuestas.

Incluso añadir una propiedad puede fallar si el receptor rechaza desconocidos. Una política estricta de entrada puede ser razonable, pero obliga a coordinar despliegues y cambios. No existe compatibilidad garantizada por el simple hecho de que siga siendo JSON.

Compartir un schema reduce duplicación dentro de un sistema. Entre lenguajes seguimos necesitando pruebas de contrato: defaults, regex, precisión y conversiones pueden diferir. No usamos el resultado de generar un tipo como sustituto de ejecutar esas pruebas.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p022/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-validation-errors
```

## Garantías y límites

El [laboratorio compartido](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-validation-errors/cases.json) incluye `reservation.schema.json`, `cases.json` y los tests. Instala con pnpm y ejecuta desde su directorio:

```bash
pnpm install --frozen-lockfile
node --test tests/validation.test.mjs
```

El test compara Ajv y Zod con los mismos documentos; no necesitas estudiar la implementación de Zod para entender el contrato. La versión Python es una alternativa de lectura, no un requisito para continuar la serie.

La reserva sigue necesitando reglas de stock y versión, además de permisos en un servicio real. Ningún schema evita una escritura concurrente entre comprobar y guardar. Aquí no hay autenticación ni base de datos. OpenAPI tampoco genera o valida automáticamente el servidor por estar en el repositorio.

## Ejercicio: opcional no significa aceptar cualquier ausencia de valor

Añade `reference`, opcional y con máximo de 30 code points, sin admitir `null`. Escribe primero casos para omisión, string vacío, límite y exceso. Justifica si un string vacío debe permitirse en tu producto: opcionalidad y contenido no vacío son decisiones independientes.

Continúa con [Zod y errores por campo](/posts/validacion-zod-contratos-errores-runtime). Si trabajas con Python, puedes ir directamente a [Pydantic](/posts/validacion-pydantic-strict-null-refinements). Ambas rutas parten de este contrato.

## Referencias

- [JSON Schema: propiedades, required y additionalProperties](https://json-schema.org/understanding-json-schema/reference/object).
- [JSON Schema: condicionales](https://json-schema.org/understanding-json-schema/reference/conditionals).
- [OpenAPI 3.1.1: Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object).
- [Ajv: soporte de JSON Schema](https://ajv.js.org/json-schema.html).
- [Zod: safeParse y tipos inferidos](https://zod.dev/basics), [API y refinements](https://zod.dev/api).
- [Pydantic: strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/) y [validators](https://docs.pydantic.dev/latest/concepts/validators/).

Fuentes consultadas el 18 de octubre de 2026. Versiones fijadas para este laboratorio, no promesa de equivalencia entre todas sus opciones.
