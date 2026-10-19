---
id: API-IDENTITY
title: 'Autenticación y autorización: una sesión válida no da acceso a cualquier pedido'
published: 2026-10-17T01:05:00Z
locale: es
translationKey: reliable-identity-authorization
slug: autenticacion-autorizacion-tenant
draft: true
status: draft
level: intermedio
prerequisites: [API-ERRORS]
description: 'Distingue sesión, token, OAuth y OIDC. Aplica autorización por objeto y tenant sin confundir un rol con acceso universal.'
author: 'Luis Ramírez Calle'
series: 'APIs y seguridad sin atajos'
tags: [seguridad, autorizacion, autenticacion, multitenancy]
---

Una persona inicia sesión correctamente y cambia el identificador de un pedido en la URL. La API devuelve un pedido de otra empresa. La autenticación funcionó; faltaba comprobar si esa identidad podía acceder a ese objeto.

Esta entrega separa **autenticación**, establecer quién actúa, de **autorización**, decidir qué puede hacer sobre un recurso concreto. Partimos de [entradas y errores de API](/posts/validacion-errores-api-problem-details), sin construir un proveedor de identidad casero.

## La identidad debe venir de una fuente verificada

Un `tenant_id` enviado en el body no demuestra pertenencia a una empresa. El servidor debe obtener el contexto autorizado a partir de una sesión verificada o de credenciales cuya validez y alcance haya comprobado.

Una **sesión** suele asociar un identificador opaco a estado mantenido en el servidor. Permite revocar ese estado, pero obliga a almacenarlo y consultarlo. Un **JWT** transporta claims firmados; poder leerlos no significa haber validado firma, algoritmo permitido, emisor, audiencia y expiración.

El JWT tampoco queda revocado automáticamente cuando un usuario pierde permisos. Su duración, refresh y mecanismo de revocación requieren decisiones explícitas. «Stateless» en una pieza no elimina el estado de todo el sistema.

## OAuth y OIDC responden a preguntas diferentes

**OAuth 2.0** permite autorización delegada. **OpenID Connect**, u **OIDC**, añade una capa de identidad. Un access token está dirigido al recurso protegido; un ID token comunica al cliente información sobre la autenticación. No intercambiamos ambos porque parezcan strings similares.

Para una aplicación web conviene usar una implementación mantenida y un flujo apropiado, como Authorization Code con PKCE cuando corresponda. Registrar una aplicación en un proveedor no evita verificar issuer, audience y redirect URIs. No incluimos una implementación de ese protocolo: hacerlo parcialmente sería una mala base para aprender seguridad.

## El rol se evalúa dentro de una frontera

Nuestro ejemplo admite un administrador de empresa y un lector propietario del pedido. Un administrador de la empresa B no administra la empresa A.

<img src="/assets/visuals/reliable-services/API-IDENTITY.svg" alt="La identidad verificada aporta tenant, usuario y rol; la política compara primero el tenant del pedido y después ownership o privilegio administrativo." width="462" height="812" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/API-IDENTITY.svg).

Archivo: `servicios-fiables/src/security.ts` (extracto).

```typescript
export function canRead(principal: Principal, resource: Resource): boolean {
  if (principal.tenant !== resource.tenant) return false
  return principal.role === 'admin' || principal.user === resource.owner
}
```

**RBAC** expresa permisos por rol. **ABAC** incorpora atributos del sujeto, recurso y contexto. La política combina un rol con pertenencia al tenant y propiedad. No necesitamos un motor de políticas para explicar tres reglas, aunque centralizarlas y auditarlas puede justificar uno cuando crezcan.

La vulnerabilidad de acceder a un objeto ajeno mediante su identificador se conoce como **BOLA**, Broken Object Level Authorization. Usar UUIDs dificulta algunas enumeraciones, pero no corrige la ausencia del control.

## La consulta también puede restringir el acceso

Una API real puede consultar por identificador y tenant autorizado, y después verificar la acción sobre el objeto. Eso reduce exposición accidental y evita cargar datos de otro ámbito. La misma frontera debe mantenerse al actualizar, listar, exportar y procesar trabajos.

Para recursos inaccesibles, un servicio puede elegir `404` para no revelar su existencia. Otro puede usar `403` cuando esa distinción sea parte del contrato. La política debe ser coherente; ocultar el botón en el frontend no autoriza nada en el servidor.

## Garantías y límites

El laboratorio prueba la política para un principal que **ya damos por autenticado**. No verifica tokens ni crea sesiones. Tampoco cubre permisos de soporte global, delegación o revocación. No presenta una función booleana como una solución completa de identidad.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Archivo: terminal, desde `servicios-fiables/`.

```bash
node --test --test-name-pattern="autorización por objeto" tests/core.test.mjs
```

## Ejercicio: intentar el acceso cruzado

Construye una tabla de casos para lectura y cancelación: propietario, otro usuario del mismo tenant y administrador de otro tenant. Cada combinación debe tener una respuesta deliberada. Una sesión válida nunca debe bastar para saltarse el tenant.

Continuamos con [los límites de confianza entre navegador, API y terceros](/posts/seguridad-api-navegador-limites-confianza).

Si necesitas desarrollar los permisos con más detalle, el bloque de [RBAC, ABAC y ownership](/posts/autorizacion-rbac-abac-permisos-recursos) amplía esta introducción en tres entregas. Añade roles por tenant, estados del documento y pruebas HTTP de lectura y modificación ajenas; utiliza un laboratorio independiente con sus límites explícitos.

## Referencias

- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [RFC 9700: prácticas de seguridad OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc9700).
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html).
- [OWASP API Security: BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).

Fuentes consultadas el 17 de octubre de 2026.
