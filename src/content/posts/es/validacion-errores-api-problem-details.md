---
id: API-ERRORS
title: 'Validación y errores de API: del JSON recibido a una decisión de negocio'
published: 2026-10-17T01:03:00Z
locale: es
translationKey: reliable-validation-errors
slug: validacion-errores-api-problem-details
draft: true
status: draft
level: intermedio
prerequisites: [API-HTTP]
description: 'Separa parsing, validación, autorización y reglas de negocio. Diseña errores estables con Problem Details sin divulgar detalles internos.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [api, typescript, validacion, seguridad]
---

Un cliente envía `status: "succeeded"` junto al importe de un pedido. El JSON es válido y la propiedad coincide con uno de nuestros estados. Aun así, aceptar ese campo dejaría al cliente decidir algo que solo debería confirmar el sistema.

Validar no consiste en comprobar que «parece un pedido». Consiste en decidir qué puede expresar **este comando**, quién puede ejecutarlo y qué reglas deben cumplirse ahora. Continuamos el [contrato HTTP](/posts/contratos-http-recursos-operaciones) con esas fronteras explícitas.

## Cuatro preguntas distintas antes de escribir

El **parsing** decide si los bytes forman un JSON válido. La **validación estructural** comprueba tipos, campos y límites. La **autorización** determina si esa identidad puede actuar sobre ese recurso. Las **reglas de negocio** deciden si la operación es válida dado el estado actual.

No conviene resolverlo todo con una única función llamada `validate`. Un esquema puede comprobar que `quantity` es positiva; no demuestra que haya stock ni que ese stock siga disponible cuando escribamos. Para eso necesitaremos las técnicas de [control de concurrencia](/posts/concurrencia-bloqueos-postgresql).

<img src="/assets/visuals/reliable-services/API-ERRORS.svg" alt="Los bytes pasan por parsing, validación del comando, autorización y reglas transaccionales; los fallos se traducen a un contrato de error público." width="624" height="1002" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-ERRORS.svg).

## No asignes el body entero a una entidad

La versión ingenua combina el objeto recibido con un registro persistente. Si el objeto contiene `owner`, `tenant` o `status`, una actualización genérica puede permitir modificar campos protegidos. Este problema se conoce como **mass assignment**.

Nuestra entrada solo admite cantidad y moneda. Archivo: `servicios-fiables/src/money.ts` (extracto).

```typescript
export function parseCommand(value: unknown): Money {
  const money = parseMoney(value)
  const keys = Object.keys(value as object)
  if (keys.some((key) => !['amount_minor', 'currency'].includes(key))) {
    throw new Error('unexpected_field')
  }
  return money
}
```

Elegimos rechazar campos desconocidos para detectar errores y no aceptar silenciosamente un intento de fijar estado. Otra política puede ignorarlos por compatibilidad, pero debe ser deliberada. En ambos casos el objeto interno se construye con una **allowlist**, no copiando todas las propiedades del body.

Para esquemas grandes, **JSON Schema** o **Zod** evitan repetir comprobaciones manuales. No introducimos una dependencia para dos campos. Eso es KISS, no una recomendación de desarrollar a mano un validador general.

## El error público también es un contrato

Archivo: `servicios-fiables/src/service.ts` (extracto).

```typescript
export function problem(code: 'invalid_input' | 'conflict' | 'unexpected') {
  const definitions = {
    invalid_input: { status: 422, title: 'Entrada no válida' },
    conflict: { status: 409, title: 'Conflicto con la operación existente' },
    unexpected: { status: 500, title: 'Error interno' },
  }
  return { type: `https://api.example/problems/${code}`, ...definitions[code], code }
}
```

La URI es ficticia: en una API real debe pertenecer al servicio y documentar el tipo de problema. El adaptador debe enviar `application/problem+json` y un status HTTP coherente con el objeto. El helper crea el cuerpo, no los headers.

**Problem Details**, definido en RFC 9457, aporta un formato común. La extensión `code` de este ejemplo es nuestra decisión. El cliente no debería interpretar textos humanos de `title` como identificadores estables.

Usamos `422` para una entrada con sintaxis correcta pero contenido inválido, `409` para un conflicto definido y `500` para un fallo no esperado. No conviertas todas las excepciones en `400`: ocultaría errores del servidor y podría inducir al cliente a corregir datos que ya eran válidos.

## No todo lo que registras debe volver al usuario

Un error de PostgreSQL puede contener nombres de tablas o datos sensibles. Un stack trace puede mostrar rutas y dependencias. El servidor necesita diagnóstico, pero el cliente necesita un contrato seguro y una referencia para soporte.

La estrategia es traducir errores conocidos y registrar los inesperados de forma controlada. No basta con borrar `stack` si después devolvemos el mensaje completo de la excepción. El ejemplo usa textos fijados y no incorpora la causa interna.

## Garantías y límites

El laboratorio comprueba rechazo de campos extra y códigos públicos. No implementa un parser HTTP con límites de body, un catálogo multilingüe ni controles de autorización completos. Un esquema válido sigue necesitando constraints de almacenamiento y reglas de negocio.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="money|caso de uso" tests/core.test.mjs
```

## Ejercicio: error útil sin detalles privados

Añade `invalid_quantity` con una referencia al campo y un mensaje comprensible. Prueba que su respuesta no incluye SQL, stack ni el body original. Una cadena enviada donde esperas un entero no debe acabar en `500`.

Seguimos con [compatibilidad y paginación](/posts/evolucion-api-paginacion-contratos): cambiar lo que aceptas también puede romper un contrato.

## Referencias

- [RFC 9457: Problem Details](https://www.rfc-editor.org/rfc/rfc9457).
- [OWASP: Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html).
- [JSON Schema: referencia de validación de objetos](https://json-schema.org/understanding-json-schema/reference/object).

Fuentes consultadas el 17 de octubre de 2026.
