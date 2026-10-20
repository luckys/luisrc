---
id: API-THREATS-ASSIGNMENT
title: 'Mass assignment: editar un título no debería permitir cambiar el propietario'
published: 2026-10-18T04:24:00Z
locale: es
translationKey: mass-assignment-comandos-propiedades-autorizadas
slug: mass-assignment-comandos-propiedades-autorizadas
draft: true
status: draft
level: intermedio
prerequisites: [P030]
description: 'Reproduce mass assignment pese a tener ownership verificado. Diseña un comando con allowlist, escritura explícita y DTO de salida, con pruebas y visor interactivo.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, mass-assignment, autorizacion, testing]
---

El endpoint comprueba que Alice es propietaria del documento y que pertenece a North. Después mezcla el body con la fila guardada. Alice añade state=published y ownerId=bob al JSON del título, y el servidor acepta ambos cambios.

El permiso sobre el documento era correcto. El fallo estaba en asumir que ese permiso incluía todas sus propiedades. **Mass assignment** aparece cuando una entrada controlada por el cliente puede asignar campos que no le corresponde modificar.

Vamos a reproducir el escenario T03 del [threat model](/posts/threat-model-api-multi-tenant-pruebas). No necesitamos un ORM para provocar el fallo; una mezcla de objetos basta para perder el límite de la operación.

## Autorizar el objeto no autoriza todas sus propiedades

Nuestra operación permite cambiar el título de un draft propio. El documento contiene más datos: tenant, propietario, estado y una nota interna. Que esos campos existan en la tabla no implica que deban aparecer en el contrato de entrada.

El permiso por objeto responde «¿puede esta persona actuar sobre d1?». El permiso por propiedad añade «¿qué puede leer o modificar de d1 mediante esta operación?». Los controles se complementan. Un DTO reducido sin verificación del objeto seguiría permitiendo cambiar títulos ajenos.

La variante insegura de `command.mjs` hace esto:

```javascript
export function unsafeAssign(document, input) {
  return { ...document, ...input }
}
```

El orden importa: las claves de input reemplazan las anteriores. La sintaxis no sabe que state representa una transición de negocio o que ownerId afecta a futuros permisos.

El problema no es el operador spread por sí mismo. Mezclar dos configuraciones internas puede ser correcto. Aquí el error es conceder a un objeto externo capacidad de decidir sobre propiedades internas.

## Una petición válida puede pedir una operación no permitida

En el [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/command.mjs), la ruta es `PATCH /tenants/north/documents/d1`. La variante `?mode=unsafe` existe solo para experimentar en loopback. Alice envía:

```json
{
  "title": "Editado",
  "ownerId": "bob",
  "state": "published"
}
```

Es JSON válido. Sus valores también podrían ser tipos válidos del modelo persistido. Incluso pasa la comprobación inicial de ownership: el documento todavía pertenece a Alice cuando la leemos.

Después de la mezcla, el test consulta SQLite y encuentra ownerId=bob y state=published. Mirar solo el status 200 o el título de la respuesta no habría mostrado el alcance del cambio. Por eso conservamos una comprobación del estado almacenado.

Ocultar esos campos en el formulario no corrige nada. El cliente puede construir otra petición. Tampoco lo hace una interfaz TypeScript que describa solo title: al ejecutar el servidor, el JSON recibido sigue necesitando validación runtime.

## Diseña el comando que la operación necesita

Un **comando** representa una intención aceptada por el servidor, no una copia editable de la tabla. En este caso contiene exactamente un título.

Este es el parser real de `command.mjs`; invalidInput, definido en el mismo archivo, produce el error que el adaptador HTTP traduce a 422:

```javascript
export function parseTitleChange(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput()
  const keys = Object.keys(input)
  if (keys.length !== 1 || keys[0] !== 'title') throw invalidInput()
  if (typeof input.title !== 'string') throw invalidInput()
  const title = input.title.trim()
  if (title.length < 1 || title.length > 120) throw invalidInput()
  return { title }
}
```

Primero exige un objeto, después una única propiedad admitida y finalmente un título string no vacío tras trim. No convierte números en texto ni permite arrays. El límite de 120 corresponde a unidades de longitud de string de JavaScript, no a 120 caracteres visuales de cualquier alfabeto.

Devolver un objeto nuevo importa: lo que avanza al siguiente paso es el comando comprobado. Si validamos input y después volvemos a propagar el objeto original, podemos reintroducir campos que el schema hubiera descartado.

Una biblioteca como Zod puede expresar este contrato con un objeto estricto. Usamos una función pequeña para que se vea el mecanismo; no porque escribir validadores manuales sea siempre preferible. Si el contrato crece, conviene aprovechar herramientas mantenidas y sus errores estructurados.

## Rechazar campos extra es una decisión de contrato

Podríamos ignorar las propiedades desconocidas en lugar de rechazarlas. Ambas políticas pueden restringir la escritura si construyen una salida permitida. En este endpoint elegimos rechazo para que el cliente no crea que publicó o transfirió algo que el servidor ignoró.

Esa decisión tiene un coste de compatibilidad: añadir un campo al cliente antes que al servidor puede causar 422. Hay que documentarla y probarla, como cualquier otra parte del contrato.

Preferimos una **allowlist**, una lista de lo permitido, a quitar campos conocidos como ownerId y state. Si mañana aparece retentionPolicy, una denylist antigua podría dejarlo pasar. La allowlist de title sigue siendo cerrada sin conocer la nueva propiedad.

Para cambios administrativos, diseñaría otro comando con su permiso y sus invariantes. Un administrador tampoco tiene por qué poder asignar libremente cualquier estado o mover un documento a un tenant arbitrario.

<img src="/assets/visuals/api-contracts/API-THREATS-ASSIGNMENT.svg" alt="El JSON externo contiene title, owner y state. La mezcla vulnerable escribe todas las propiedades. El comando seguro acepta únicamente title; el UPDATE limita la columna y vuelve a exigir tenant, owner y draft antes de devolver un DTO público." width="377" height="1076" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-ASSIGNMENT.svg).

## Escribe también una columna explícita

En `store.mjs`, changeTitle ejecuta un UPDATE que solo asigna title. Su WHERE exige tenant, id, propietario y estado draft mediante parámetros. Así una comprobación previa no es la única condición que protege la escritura después de haber esperado a recibir el body.

El test modifica antes el estado a published y exige que changeTitle ya no actualice nada. También lo intenta con otro subject. No presentamos esto como una prueba de todas las carreras posibles, pero sí comprobamos que la propia operación de escritura conserva esas condiciones.

La respuesta usa un **DTO de salida**, una representación pública con id y title. No serializamos la fila completa. Restringir entrada y salida atiende dos riesgos distintos: cambiar una nota interna y verla en una respuesta no son el mismo fallo.

La categoría API3:2023 de OWASP relaciona precisamente la autorización de propiedades con escritura no permitida y exposición excesiva. Nuestro ejemplo no implementa una política general de campos por rol: tiene una sola operación y una proyección fija.

## Un visor permite observar qué cambió

Abre el [comparador interactivo de mass assignment](/assets/interactive/api-assignment/explorer.html). Primero prueba solo title: ambos caminos lo cambian. Después selecciona la entrada con propietario, estado y tenant.

La mezcla modifica tres propiedades protegidas. El comando seguro devuelve un 422 simulado y conserva todo el documento, incluido el título. Puedes editar el JSON y comparar otra vez; Restablecer recupera el ejemplo inicial.

La barra cuenta diferencias de esas tres propiedades. No estima riesgo, no detecta ataques y no consulta SQLite. Es una representación didáctica que comparte el parser y la mezcla con el laboratorio; las pruebas HTTP y de base de datos son la evidencia del servidor real.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-assignment/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

Con Node 24.19.0 o posterior, ejecuta `pnpm test` en el laboratorio, sin instalar paquetes. El bloque inicial aporta trece tests; las entregas posteriores amplían el conjunto. Aquí se prueban propiedades reservadas, una propiedad futura, objetos anidados y una clave `__proto__` obtenida con JSON.parse. Todos los rechazos del camino seguro conservan el estado anterior.

La prueba con `__proto__` comprueba rechazo de una clave no permitida; no afirma que la mezcla mostrada explote prototype pollution. Son problemas diferentes y no conviene usar el nombre de una vulnerabilidad para describir otra sin demostrarla.

Solo se admite un cambio de título. No hay PATCH genérico, edición anidada, versiones optimistas o publicación real. Dos cambios de título válidos siguen una política last write wins. Identidad de fixture, HTTP local y SQLite en memoria no son una aplicación preparada para producción.

## Ejercicio: añadir una propiedad sin abrir todo el modelo

Añade summary como texto opcional con un límite propio. Decide qué significa omitirlo, enviarlo vacío o enviarlo como null. Escribe primero los tests y actualiza parser, SQL y DTO de manera explícita.

Mantén el rechazo de ownerId y state. Si para añadir una descripción necesitas permitir cualquier propiedad de la tabla, el contrato se ha ampliado más de lo que pide la función.

En la [siguiente entrega sobre SQL injection](/posts/sql-injection-parametros-tenant-ordenacion) veremos otra frontera: incluso un campo permitido puede ser peligroso si lo convertimos en sintaxis SQL.

## Referencias

- [OWASP: Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html).
- [OWASP API3:2023: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/).

Fuentes consultadas el 19 de octubre de 2026. Los resultados y el contador del visor pertenecen exclusivamente a este ejemplo.
