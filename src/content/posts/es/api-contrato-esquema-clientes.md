---
id: P020
title: 'Diseñar una API: el contrato es más que un JSON que funciona'
published: 2026-10-18T04:00:00Z
locale: es
translationKey: api-contract-schema-consumers
slug: api-contrato-esquema-clientes
draft: true
status: draft
level: intermedio
prerequisites: [P008]
description: 'Diseña un contrato de pedidos con OpenAPI y comprueba su implementación por HTTP. Esquema, semántica, serialización y expectativas del cliente.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, contratos, openapi, http, backend]
---

Dos clientes reciben el mismo JSON y lo interpretan de manera distinta. Uno entiende que `amount: 1250` son euros; otro, céntimos. Ningún parser ha fallado, pero el acuerdo entre ambos y el servidor nunca estuvo bien definido.

Una **API**, application programming interface, publica una manera de pedir capacidades a otro componente. Puede ser una biblioteca local o un servicio remoto. En esta serie nos centramos en APIs web: contratos que deben sobrevivir a redes, distintos clientes y despliegues que no ocurren a la vez.

Partimos de [HTTP y sus representaciones](/posts/http-semantica-versiones-etag-cache). Usaremos un servidor pequeño de **Node.js** y pedidos ficticios para comprobar qué prometemos sin ocultarlo detrás de un generador.

## Interfaz e implementación cambian por motivos diferentes

La **interface** describe lo que un consumidor puede solicitar y observar. La implementación decide cómo hacerlo: un Map, PostgreSQL, otro servicio o varias funciones internas.

Si sustituimos un Map por una base de datos sin alterar la promesa observable, el cliente no debería necesitar otro campo para seguir creando pedidos. Si cambiamos la unidad del importe manteniendo su nombre, sí cambiamos el contrato aunque el router siga igual.

Exponer nombres de columnas o excepciones del driver acopla al consumidor a decisiones internas. Una representación específica permite elegir qué significado queremos mantener estable, en lugar de exportar accidentalmente todo el modelo de almacenamiento.

<img src="/assets/visuals/api-contracts/P020.svg" alt="El consumidor y el servidor comparten un contrato con esquema, significado y errores; el servidor valida y guarda un pedido en memoria antes de responder con su URI." width="652" height="1270" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama del contrato](/assets/visuals/api-contracts/P020.svg).

## Protocolo, representación y esquema no son lo mismo

**HTTP** define métodos, mensajes y semántica de respuestas. **JSON** representa datos. Un **schema** restringe qué documentos admitimos. Ninguna de esas piezas decide por sí sola qué significa que un pedido exista.

Nuestro contrato utiliza `POST /orders`. La entrada contiene `amountMinor`, un entero entre 1 y 1.000.000, y `currency`, EUR o USD. `amountMinor: 1250` con EUR significa 12,50 euros, no 1.250 euros ni un string convertido silenciosamente.

`label` es opcional y admite hasta 80 code points Unicode. En JavaScript, `string.length` cuenta unidades UTF-16 y ciertos caracteres necesitan dos. Contar code points tampoco equivale a contar símbolos visuales completos o grapheme clusters. El laboratorio prueba emoji para mantener alineada la restricción con el esquema.

Este es `OrderInput`, extraído de `openapi.json`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["amountMinor", "currency"],
  "properties": {
    "amountMinor": { "type": "integer", "minimum": 1, "maximum": 1000000 },
    "currency": { "type": "string", "enum": ["EUR", "USD"] },
    "label": { "type": "string", "maxLength": 80 }
  }
}
```

Rechazar propiedades desconocidas es una política de esta entrada, no una regla universal. Evita aceptar campos como `admin` que el cliente no controla. También significa que añadir un campo desde un cliente nuevo puede fallar contra un servidor antiguo. La compatibilidad requiere considerar ambas direcciones.

## Crear necesita un resultado que se pueda interpretar

Una creación válida devuelve `201 Created`, `Location: /orders/o1` y el pedido con su `id`. La URI permite recuperarlo mediante GET. El ID es opaco para el consumidor: que esta demo use o1 no autoriza a deducir el siguiente en una integración real.

```http
POST /orders HTTP/1.1
Content-Type: application/json

{"amountMinor":1250,"currency":"EUR","label":"Libro"}
```

El servidor valida antes de guardar. Bloque de creación de `server.mjs`:

```javascript
const input = parseOrder(await readJSON(request))
const order = { id: `o${++sequence}`, ...input }
orders.set(order.id, order)
send(response, 201, order, { Location: `/orders/${order.id}` })
```

Un Map hace consultable el recurso mientras vive ese proceso; no lo hace duradero. Si reiniciamos, desaparece. El ejemplo demuestra comportamiento local, no persistencia de producción.

## Serializar no conserva automáticamente los tipos

La **serialization** convierte datos en una representación transmisible. Métodos, prototipos o referencias compartidas de un objeto no viajan como tales en JSON. El receptor obtiene un documento que debe interpretar y validar.

JSON distingue número de string, pero no define una clase Money ni una instancia de Date. El consumidor necesita conocer unidades, formatos, precisión y campos opcionales. Un tipo TypeScript local no valida la respuesta recibida por red.

Usamos enteros pequeños y explícitos para evitar ambigüedades de precisión y unidad. No es una biblioteca monetaria general: otras monedas tienen diferentes unidades menores y otro dominio podría necesitar cantidades mayores o decimales exactos.

## El cliente también debe saber qué no puede asumir

Un `422` indica restricciones incumplidas. `400` cubre JSON malformado; `415`, un tipo de contenido no aceptado; `413`, un cuerpo excesivo. Devolvemos **Problem Details** básico sin stack ni mensajes internos.

Una desconexión no equivale a esos errores. El cliente puede no saber si se guardó el pedido antes de perder la respuesta. Repetir nuestro POST crea otro pedido: no hay idempotency keys ni reconciliación.

Los límites forman parte del acuerdo: 4.096 bytes por cuerpo aceptado, monedas admitidas y campos editables. Autenticación y permisos están ausentes en la demo local, no resueltos por OpenAPI.

## Resources y RPC presentan capacidades de formas distintas

Una interfaz orientada a **resources** identifica pedidos y ofrece operaciones sobre ellos. Una interfaz **RPC** puede publicar `CreateOrder`. Ambas necesitan significado, validación y tratamiento de fallos.

Si una acción no encaja como actualización de campos, un comando explícito puede ser más claro. No hay que disfrazarla de GET porque la URL permita escribir un verbo.

**OpenAPI 3.1.1**, versión fijada aquí, describe rutas, cuerpos y respuestas. No expresa por sí solo todas las reglas de negocio ni demuestra que el servidor cumpla el documento. Un contrato que nadie contrasta puede quedarse obsoleto.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p020/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-contracts
```

## Garantías y límites

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-contracts/openapi.json) prueba HTTP real para crear, leer, sustituir, cambiar parcialmente y borrar. También prueba entradas inválidas y límites. Usa Node 24.19.0 sin instalaciones.

La validación es manual y cubre el subconjunto declarado, no un motor general JSON Schema. No hay autenticación, pagos ni base de datos. Los tests tampoco certifican compatibilidad con todos los consumidores ni una implementación completa de HTTP para producción.

```bash
node --test tests/*.test.mjs
node server.mjs
```

El segundo comando imprime un puerto local efímero. El README contiene llamadas curl. Ctrl+C cierra el servidor y el estado se pierde.

## Ejercicio: cambiar la unidad sin cambiar el tipo

Sustituye `amountMinor` por `amount` sin explicar su unidad. Escribe dos interpretaciones y muestra por qué ambas pasarían un test que solo exige un número. Después diseña una transición que evite esa ambigüedad.

Continuamos con [métodos HTTP y recursos](/posts/recursos-http-metodos-idempotencia). Ya sabemos qué intercambiamos; falta justificar qué significa cada operación.

## Referencias

- [OpenAPI 3.1.1: documento y schemas](https://spec.openapis.org/oas/v3.1.1.html).
- [RFC 8259: JSON](https://www.rfc-editor.org/rfc/rfc8259).
- [JSON Schema 2020-12: validación](https://json-schema.org/draft/2020-12/json-schema-validation).
- [RFC 9457: Problem Details](https://www.rfc-editor.org/rfc/rfc9457).
