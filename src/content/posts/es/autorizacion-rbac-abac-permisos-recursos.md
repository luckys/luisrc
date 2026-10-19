---
id: P028
title: 'Autorización por recurso: combinar RBAC, ABAC y ownership sin permisos implícitos'
published: 2026-10-18T04:16:00Z
locale: es
translationKey: autorizacion-rbac-abac-permisos-recursos
slug: autorizacion-rbac-abac-permisos-recursos
draft: true
status: draft
level: intermedio
prerequisites: [P026, P027]
description: 'Diseña una política de permisos por documento con roles, ownership, estado y tenant. Ejemplos ejecutables y decisiones que deniegan por defecto.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, autorizacion, rbac, abac, testing]
---

Alice es editor en North y reader en South. Si la API guarda un único rol para su cuenta, una sesión legítima puede terminar concediéndole edición en una organización donde solo debía leer.

En el bloque de [OIDC](/posts/oauth-oidc-authorization-code-pkce) comprobamos quién está accediendo. Ahora necesitamos responder otra pregunta: **¿puede esta identidad realizar esta acción sobre este documento, dentro de este tenant y en su estado actual?**

Vamos a construir una política pequeña, no un motor genérico de permisos. Tendrá tres roles y dos acciones. El objetivo es poder leer cada regla, explicar por qué existe y escribir un caso que falle si se elimina.

## Autenticación y autorización producen decisiones distintas

La **autenticación** permite reconocer una identidad mediante el mecanismo elegido. La **autorización** evalúa si esa identidad dispone del permiso necesario para una operación. Una identidad reconocida puede recibir una denegación perfectamente correcta.

El **tenant** es el ámbito de una organización cliente. En la demo hay dos, North y South. Alice trabaja en ambos, pero no tiene el mismo rol en los dos. Si guardásemos simplemente `alice.role = editor`, perderíamos una parte esencial del significado del permiso.

El servidor debe obtener la identidad de una credencial verificada. Después consulta la pertenencia al tenant, llamada **membership**, y el rol local. Un `role: admin` enviado por el navegador no sustituye esa consulta.

El laboratorio usa credenciales públicas de fixture para aislar este problema. `alice-demo` se resuelve a `user-alice`, un ID interno. No implementa login ni integra el proveedor del bloque anterior. En una aplicación con OIDC resolveríamos la identidad verificada, por ejemplo mediante la pareja issuer y sub, a ese identificador interno.

## RBAC organiza capacidades por rol, no por nombre de usuario

**RBAC**, Role-Based Access Control, agrupa permisos mediante roles. Nos permite expresar que reader no puede editar y que editor puede participar en la edición, sin escribir una excepción para cada persona.

Pero «editor puede editar» todavía deja preguntas abiertas: ¿cualquier documento?, ¿también uno publicado?, ¿dentro de otra organización? Un rol útil no elimina la necesidad de definir su ámbito.

Elegimos tres roles locales: **reader**, **editor** y **admin**. Admin administra documentos de su tenant, no toda la plataforma. No hay una regla escondida que le conceda acceso global porque el nombre parezca importante.

Esta es la parte de la política que un lector debería poder discutir antes de mirar el código:

<div role="region" aria-label="Política de lectura y edición por rol" tabindex="0" style="overflow-x:auto">

| Rol en el tenant | Leer published | Leer draft o archived | Editar título              |
| ---------------- | -------------- | --------------------- | -------------------------- |
| reader           | Sí             | Solo propios          | Nunca                      |
| editor           | Sí             | Solo propios          | Solo draft propio          |
| admin            | Sí             | Cualquiera del tenant | Cualquier draft del tenant |

</div>

**Published no significa público en Internet**: sigue haciendo falta membership. Hemos elegido esas reglas para el ejercicio. Otro producto podría tener lectores de drafts compartidos o un proceso distinto para publicar. Copiar los nombres de los roles sin acordar esas reglas no sirve de mucho.

## ABAC añade atributos del recurso y del contexto

**ABAC**, Attribute-Based Access Control, toma decisiones utilizando atributos. Aquí importan el rol local del sujeto, el tenant del contexto, el tenant del documento y su estado. El [modelo de NIST](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) describe esta forma de evaluar atributos del sujeto, objeto, operación y entorno.

**Ownership** expresa una relación: el propietario del documento coincide con el sujeto. En nuestro código esa relación se comprueba comparando dos IDs internos. No estamos implementando un grafo de relaciones ni un sistema completo de ReBAC, Relationship-Based Access Control.

La regla de escritura combina ambas ideas. Tener rol editor es necesario para editar un draft propio; ser propietario no permite a un reader saltarse su rol. Admin puede editar drafts ajenos dentro de su ámbito, pero ni siquiera admin puede modificar uno publicado o archivado mediante esta operación.

No es que ABAC haga innecesario RBAC. Los roles simplifican grupos de capacidades y los atributos limitan cuándo se pueden usar. Intentar representar cada combinación con otro rol, como `editor_de_drafts_propios_de_north`, multiplicaría nombres sin hacer más comprensible la política.

## Una función pura hace visible la decisión completa

`policy.mjs` no lee HTTP, cookies o bases de datos. Recibe un contexto ya construido por el servidor y devuelve un booleano. Así podemos probar reglas sin arrancar un login en cada caso.

```javascript
const roles = new Set(['reader', 'editor', 'admin'])
const states = new Set(['draft', 'published', 'archived'])

export function can(context, action, document) {
  if (!context?.subject || !context.tenantId || !roles.has(context.role)) return false
  if (!document?.ownerId || !states.has(document.state)) return false
  if (context.tenantId !== document.tenantId) return false
  const owns = document.ownerId === context.subject
  if (action === 'read')
    return document.state === 'published' || owns || context.role === 'admin'
  if (action === 'write')
    return (
      document.state === 'draft' &&
      (context.role === 'admin' || (context.role === 'editor' && owns))
    )
  return false
}
```

El orden importa para entenderla. Antes de evaluar una capacidad exigimos contexto, rol y atributos conocidos. Después comprobamos el tenant. Solo entonces aplicamos la regla de la acción.

Una acción nueva, por ejemplo export, acaba en false. Un estado desconocido también se rechaza. Eso es **deny by default**: las entradas no contempladas no heredan un permiso porque se parezcan a un caso existente. [OWASP recomienda denegar por defecto y revisar permisos en cada petición](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

<img src="/assets/visuals/api-contracts/P028.svg" alt="La decisión exige primero contexto y atributos conocidos, después igualdad de tenant y finalmente una regla explícita de lectura o edición. Los casos desconocidos terminan denegados, también para admin." width="275" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P028.svg).

## El contexto es confiable por cómo se construye, no por su tipo

La función podría devolver true para un objeto inventado en una consola. Eso no concede acceso al servidor. Lo decisivo es que el handler no construya su contexto con los atributos que acaba de afirmar el cliente.

En la demo la identidad procede del adaptador de fixture y el rol de la tabla de memberships. El tenant solicitado en la URL se valida contra esa tabla. Los datos del documento salen del almacenamiento acotado a ese tenant. El body de PATCH solo puede proponer un título.

Un tipo TypeScript llamado `TrustedContext` ayudaría a organizar llamadas, pero no verificaría por sí mismo el origen de un JSON. Tampoco sirve ocultar el botón de editar: cualquier cliente HTTP puede enviar la petición. La interfaz adapta la experiencia; el backend toma la decisión.

## Least privilege también limita las operaciones de admin

**Least privilege** consiste en conceder las capacidades necesarias para el trabajo previsto, con el ámbito adecuado. No significa acumular comprobaciones sin una regla de producto detrás.

Por eso este PATCH no transfiere propiedad ni publica documentos. Incluso un admin solo puede cambiar el título de un draft. Si el producto necesita publicar, definiremos esa acción y sus condiciones por separado, en lugar de aceptar cualquier propiedad porque el usuario ya pudo abrir el editor.

Una política pequeña tiene menos casos que revisar, pero también menos capacidades. No resuelve delegación temporal, equipos anidados o excepciones legales. Si esas necesidades aparecen, habrá que ampliar el modelo y sus pruebas. Añadir hoy un lenguaje de políticas externo no las define automáticamente.

## Probar combinaciones evita que una excepción abra otra puerta

El laboratorio incluye una matriz explícita con diez filas y expectativas de lectura y escritura. No calcula el resultado esperado llamando de nuevo a can: eso solo compararía la función consigo misma.

Además hay casos para otro tenant, rol desconocido, acción desconocida y contexto incompleto. Esta última prueba encontró un defecto durante el desarrollo: sin exigir tenant, dos valores ausentes podían coincidir. Se corrigió exigiendo el atributo antes de comparar.

Puedes cambiar rol, propietario, estado, acción y tenant en el [explorador interactivo](/assets/interactive/api-authorization/explorer.html). Ejecuta la misma función, sin hacer peticiones ni autenticar a nadie. Prueba admin con un documento de South y después editor con un documento propio publicado: ambos intentos de edición deben quedar denegados por motivos distintos.

## Garantías y límites

Descarga el [laboratorio de permisos](/assets/examples/api-permisos-lab.zip) y ejecuta:

```bash
node --test tests/policy.test.mjs
```

Son cinco tests de política, complementados por trece tests HTTP. El modelo está en memoria, utiliza datos ficticios y no pretende verificar la autenticación. No demuestra aislamiento SQL, cachés coherentes, permisos distribuidos ni una política adecuada para cualquier organización.

La función pura permite revisar la decisión; todavía falta comprobar que todos los accesos a datos la utilizan. Esa es la responsabilidad del [siguiente artículo: construir un contexto multi-tenant y mantenerlo hasta la escritura](/posts/autorizacion-multi-tenant-contexto-datos).

## Ejercicio: permitir publicar no es permitir editar

Escribe primero una prueba para una nueva acción publish: solo admin del tenant y solo desde draft. Comprueba que reader, editor propietario, otro tenant y estado archived siguen denegados. Después añade la regla sin cambiar el significado de write.

Antes de implementar un endpoint, decide si publicar conserva la propiedad, qué estado resulta y cómo se impedirá una transición concurrente incompatible. El booleano de permisos es una parte de la operación, no su especificación completa.

## Referencias

- [NIST SP 800-162: definición y consideraciones de ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final).
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [OWASP API1:2023, Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).

Fuentes consultadas el 19 de octubre de 2026. Las reglas concretas pertenecen al laboratorio, no son una prescripción de esas referencias.
