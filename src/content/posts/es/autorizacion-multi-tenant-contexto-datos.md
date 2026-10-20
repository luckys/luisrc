---
id: API-AUTHZ-TENANT
title: 'Autorización multi-tenant: llevar el contexto hasta la lectura y la escritura'
published: 2026-10-18T04:17:00Z
locale: es
translationKey: autorizacion-multi-tenant-contexto-datos
slug: autorizacion-multi-tenant-contexto-datos
draft: true
status: draft
level: intermedio
prerequisites: [P028]
description: 'Construye tenant context desde identidad y membership verificadas. Evita mezclar roles, IDs, listados y escrituras entre organizaciones.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, autorizacion, multitenancy, backend, testing]
---

El endpoint comprueba que Alice pertenece a North. Después busca el documento únicamente por su ID y devuelve una fila de South. La comprobación de membership era correcta; la consulta posterior perdió el ámbito que acabábamos de verificar.

En [la política RBAC y ABAC](/posts/autorizacion-rbac-abac-permisos-recursos) definimos quién puede leer o editar. Ahora tenemos que conservar esa decisión durante el acceso a datos. Un permiso bien escrito no protege una ruta que nunca lo consulta.

Seguiremos con documentos ficticios en memoria. La implementación permite observar errores de aislamiento sin necesitar una base de datos; cuando hablemos de trasladarla a SQL distinguiremos las condiciones necesarias de las garantías que realmente hemos probado.

## El tenant solicitado no es todavía un tenant autorizado

La ruta de la demo es `/tenants/north/documents/shared`. North es una entrada del cliente, igual que shared. El servidor no puede aceptarla como un contexto verificado solo porque aparece en una URL con una estructura válida.

Primero se resuelve la credencial a una identidad interna. Después se busca su **membership** para el tenant solicitado. Solo con ese resultado construimos el **tenant context**, que reúne sujeto, rol local y tenant.

Elegir el tenant en una URL, un subdominio o un header puede ser una decisión razonable de diseño. Ninguna opción elimina la verificación. La entrada selecciona el ámbito que se solicita; el servidor decide si esa identidad puede actuar dentro de él.

En el laboratorio Alice es editor en North y reader en South. Un token no dice «Alice es editor en cualquier lugar». El mismo identificador de usuario participa en dos memberships con privilegios diferentes.

## La pertenencia y el rol se consultan juntos

El handler obtiene el sujeto del adaptador de autenticación. Para mantener el ejemplo centrado en permisos, ese adaptador usa tokens públicos como `alice-demo`; no son credenciales seguras ni una alternativa al login del bloque anterior.

La construcción del contexto en `server.mjs` es esta:

```javascript
const role = store.membership(subject, tenantId)
if (!role) throw fail(404, 'not_found')
const context = { subject, role, tenantId }
const scoped = store.inTenant(context.tenantId)
```

`X-Role`, `X-Tenant-Id` y un parámetro role de la query no participan en esa decisión. Que un proxy interno pudiera aportar contexto autenticado sería otro contrato, con su propia frontera de confianza; esta aplicación no trata esos headers arbitrarios como una identidad de infraestructura.

La tabla se consulta en cada petición. Por eso rebajar a Alice a reader impide la siguiente edición con el mismo token, y retirar su membership impide la siguiente lectura. El token sigue reconociendo a Alice; lo que ha cambiado es su permiso local.

Con un caché de memberships esa actualización dejaría de ser necesariamente inmediata. Habría que elegir una ventana aceptable, invalidación y comportamiento ante errores. Este laboratorio no tiene ese caché y no demuestra una revocación instantánea entre réplicas.

## Un almacenamiento scoped reduce olvidos, pero no autoriza por sí solo

La fixture guarda documentos con una clave compuesta por tenant e ID. Por eso puede existir shared en North y también en South sin que una fila sustituya a la otra.

`store.inTenant(...)` devuelve operaciones acotadas a ese ámbito. La búsqueda individual dentro de ese objeto conserva el tenant:

```javascript
find(id) {
  const row = documents.get(key(tenantId, id))
  return row && { ...row }
},
```

El fragmento pertenece al objeto devuelto por inTenant en `fixtures.mjs`. Devolver una copia evita que una lectura modifique accidentalmente el objeto almacenado. No convierte el documento en inmutable para siempre ni añade persistencia.

Este wrapper mejora la forma de usar el almacenamiento, pero un programador aún podría invocarlo con un tenant no verificado. La protección combina el contexto construido por el handler, la búsqueda acotada y la política por objeto. Ninguna de las tres piezas debe presentarse como sustituta de las otras.

El diseño evita exponer en el handler un cómodo `findDocument(id)` global. No estamos creando una jerarquía de repositorios o un framework de autorización. Solo hacemos que la operación habitual pida explícitamente el ámbito que necesita.

<img src="/assets/visuals/api-contracts/API-AUTHZ-TENANT.svg" alt="La credencial determina un sujeto y la URL solicita un tenant. La membership verificada construye el contexto, que acota la búsqueda del documento. La política por objeto se evalúa antes de proyectar la respuesta o guardar el título." width="297" height="1028" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-AUTHZ-TENANT.svg).

## La lista también es una operación de autorización

Proteger GET de un documento y olvidarse del listado sigue exponiendo datos. Puede filtrar títulos, propietarios o incluso el número de documentos privados aunque el detalle individual devuelva una denegación.

La secuencia correcta para la semántica de esta demo es: **acotar por tenant, filtrar por visibilidad, calcular el total visible y aplicar el límite**. Un reader de North sin documentos propios ve únicamente el documento published, aunque haya drafts anteriores en el orden de inserción.

```javascript
const visible = scoped.list().filter((row) => can(context, 'read', row))
send(response, 200, {
  items: visible.slice(0, Number(rawLimit)).map(representation),
  total: visible.length,
})
```

Si cortásemos primero una lista global, podríamos devolver páginas vacías aunque hubiera documentos autorizados después. Si calculásemos el total antes de filtrar, el contador describiría información que el lector no puede consultar.

Filtrar un Map pequeño es suficiente para el ejercicio, no una recomendación para cargar millones de filas y descartar casi todas en JavaScript. En una base de datos, el alcance y los predicados de visibilidad deberían formar parte de las consultas que producen tanto las filas como el contador, si existe. Esa traducción necesita pruebas de integración propias.

La entrega de [paginación](/posts/paginacion-offset-keyset-postgresql-concurrencia) estudió orden y cursores. Un cursor no concede acceso: al usarlo hay que volver a aplicar el contexto autorizado. Aquí solo hay un límite de 1 a 20, sin cursor ni navegación concurrente.

## Autorizar la escritura exige conservar el objeto y su estado

PATCH acepta un objeto con una única propiedad title. Se rechazan tenantId, ownerId, state y role, aunque title sea válido. El servidor construye la mutación concreta; no hace una copia abierta de todas las propiedades recibidas.

Eso evita una vía de **mass assignment**, pero todavía no demuestra que el usuario pueda editar ese título. También se consulta la política de escritura, que exige draft y el rol o ownership correspondientes. Validación de entrada y autorización responden preguntas diferentes.

El body se termina de leer antes de consultar membership y documento. Desde esa consulta hasta modificar el Map no hay await. En este proceso JavaScript concreto no se intercala otra tarea durante ese tramo síncrono.

Esa propiedad no se traslada automáticamente a una operación con base de datos. Si leer el documento y guardarlo son llamadas asíncronas, su estado o sus permisos pueden cambiar entre ambas. Habrá que preservar las condiciones relevantes en la escritura, utilizar el control de concurrencia adecuado y definir la semántica de revocación. **Un if previo no es una transacción SQL**.

## 404 y 403 expresan una política de exposición

Sin una identidad reconocida respondemos **401** con un challenge Bearer. Si falta membership, el documento no existe en el ámbito o no es visible, respondemos **404** con el mismo cuerpo público.

Si el sujeto ya puede leer el documento pero no editarlo, respondemos **403**. Un reader puede saber que existe un documento published, así que esa distinción no revela una existencia que intentáramos ocultarle. Esta es una decisión de la demo, no una obligación de toda API.

HTTP permite utilizar 404 para ocultar la existencia de un recurso prohibido; lo recoge [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4). Igualar status y estructura del cuerpo no demuestra igualdad de tiempos o eliminación de cualquier canal lateral. Los tests comprueban lo primero, no lo segundo.

Las respuestas llevan no-store y una proyección explícita de salida. internalNote permanece en el almacenamiento, no en el JSON público. El aislamiento entre tenants tampoco se arreglaría simplemente eliminando ese campo si el título entero perteneciera a otra organización.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-authz-tenant/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-authorization
```

## Garantías y límites

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-authorization/fixtures.mjs) ejecuta trece tests HTTP y cinco de política, sin dependencias externas:

```bash
pnpm test
```

Verifica IDs repetidos en tenants diferentes, lectura y modificación ajenas, roles locales, retirada de membership, listados y estado posterior. El servidor escucha solo en loopback y pierde todos los datos al terminar.

No hay SQL, **Row-Level Security**, búsquedas externas, caché, exportaciones, archivos adjuntos o workers. Esos canales también necesitarían contexto y controles si se añadieran. Las recomendaciones de [OWASP para multi-tenancy](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) ayudan a revisar esas superficies; este ejemplo solo implementa las rutas descritas.

## Ejercicio: revisar una exportación antes de programarla

Diseña GET de exportación para reader y admin. Escribe qué documentos puede incluir y de dónde procede el tenant de un trabajo en segundo plano. Decide también qué ocurre si se retira la membership entre solicitarlo y descargarlo.

Después escribe un test donde North y South tengan un documento con el mismo ID y títulos distintos. La exportación debe comprobar algo más útil que «devuelve 200»: no puede contener el título ajeno. El [siguiente artículo](/posts/autorizacion-tests-adversariales-bola) convierte esta forma de pensar en pruebas HTTP de lectura y escritura.

## Referencias

- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html).
- [RFC 9110: semántica de 403 y posibilidad de responder 404](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4).
- [OWASP API1:2023, autorización a nivel de objeto](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).

Fuentes consultadas el 19 de octubre de 2026. La atomicidad descrita se limita al tramo síncrono del proceso local.
