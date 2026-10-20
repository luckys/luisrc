---
id: API-THREATS-CREDENTIALS
title: 'API keys: verificar al cliente sin confundir identidad y permisos'
published: 2026-10-18T04:30:00Z
locale: es
translationKey: api-keys-credenciales-clientes-permisos
slug: api-keys-credenciales-clientes-permisos
draft: true
status: draft
level: intermedio
prerequisites: [API-THREATS-RATE]
description: 'Comprueba credenciales opacas de clientes con caducidad, revocación y scopes. Pruebas HTTP de claves alteradas, aislamiento de tenant y fallos del almacén.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, api, credenciales, multi-tenant, testing]
---

Una integración envía el identificador de North y pide leer sus documentos. Eso nos dice a qué tenant quiere acceder, no quién está haciendo la petición. Si aceptamos ese dato como prueba de identidad, cualquier cliente puede sustituirlo por South.

Necesitamos verificar una credencial antes de decidir qué puede hacer el cliente. Vamos a sustituir las identidades públicas del laboratorio por claves aleatorias emitidas en memoria, con **caducidad**, **revocación** y permisos acotados. No vamos a construir un sistema de login para personas.

El [threat model de la API](/posts/threat-model-api-multi-tenant-pruebas) separaba identidad, autorización y secretos. Aquí desarrollamos la primera frontera para un cliente de servicio. El siguiente artículo aborda cómo [recargar y rotar esa credencial](/posts/secretos-rotacion-recarga-revocacion) sin imprimirla en logs.

## Una API key representa a una integración, no a una persona

El consumidor será `sync-north`, un proceso que lee documentos de North. **subject** identifica a ese cliente; no afirma que Alice esté delante del teclado ni que haya autorizado una operación concreta en ese momento.

Esta distinción importa si una integración actúa en nombre de usuarios. Una clave compartida por toda la aplicación no permite atribuir cada acción a una persona. Necesitaríamos un flujo de identidad y delegación adecuado, no añadir `userId: alice` al body y confiar en él.

[OWASP API2](https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/) advierte expresamente que las API keys no deben usarse para autenticar usuarios. Las [sesiones web](/posts/sesiones-web-cookies-identidad) y [OIDC](/posts/oauth-oidc-authorization-code-pkce) siguen siendo temas distintos: una clave de servicio no sustituye login, MFA, recuperación de cuenta o reautenticación para acciones sensibles.

En un sistema real valoraríamos credenciales de corta duración emitidas mediante un protocolo y proveedor adecuados. El formato propio que usamos aquí sirve para observar comprobaciones y fallos en un ejercicio local; no es una recomendación de crear otro protocolo de identidad.

## Genera el secreto, pero guarda su digest en el verificador

El formato del laboratorio es `lab1.identificador.secreto`. El identificador son ocho bytes aleatorios codificados en hexadecimal; el secreto son otros 32 bytes generados con **randomBytes** de Node. Los puntos y el prefijo solo permiten interpretar la entrada.

El identificador selecciona un registro. No concede acceso por sí mismo. El servidor calcula **SHA-256** sobre la credencial completa y conserva ese digest junto a subject, tenant, scopes, fecha de expiración y marca de revocación. Devuelve el token al código que lo solicita, pero no lo guarda como valor en ese registro.

Esto no significa que el secreto nunca esté en memoria: debe existir al emitirlo, al recibirlo y en el cliente que lo presenta. Tampoco protege ante un atacante que pueda modificar el verificador o su almacenamiento.

Usamos un hash rápido porque el secreto tiene 256 bits aleatorios, no una contraseña elegida por una persona. **No traslades esta elección al almacenamiento de contraseñas**: son problemas con espacios de búsqueda muy diferentes.

La emisión es una función administrativa del test, no un endpoint público. Subject, tenant y scopes proceden de metadatos controlados por el servidor. Permitir que el propio consumidor se emita una clave con cualquier tenant anularía todo lo demás.

## Rechaza una entrada ambigua antes de buscar identidad

La API acepta exactamente una cabecera **Authorization** y el esquema Bearer. En este ejercicio, quien posee el token puede usarlo: no hay prueba adicional de posesión de una clave privada.

`parseCredential`, en `credentials.mjs`, acota longitud y forma antes de consultar el registro:

```javascript
export function parseCredential(header) {
  if (typeof header !== 'string' || header.length > 128) return undefined
  const match = /^Bearer (lab1\.[a-f0-9]{16}\.[a-f0-9]{64})$/i.exec(header)
  if (!match || !/^lab1\.[a-f0-9]{16}\.[a-f0-9]{64}$/.test(match[1])) return undefined
  return { token: match[1], id: match[1].split('.')[1] }
}
```

El esquema puede escribirse en minúsculas, pero el formato del token exige su representación hexadecimal en minúsculas. No aceptamos espacios finales, prefijos parciales, otra codificación o un token añadido al final de uno válido.

El adaptador cuenta las cabeceras originales en rawHeaders para rechazar dos Authorization, en lugar de depender de cómo una librería las combine. En un despliegue con proxies habría que verificar también cómo interpretan esa entrada los intermediarios. Una prueba contra nuestro servidor no demuestra el comportamiento de toda la cadena.

No buscamos credenciales en la URL ni usamos X-User o X-Tenant como sustitutos. Enviar secretos en una query facilita que acaben en lugares como historiales y registros de acceso.

## Comprueba caducidad y revocación en cada solicitud

Este método pertenece a `createCredentials`. records es el Map interno, timestamp valida el reloj inyectado y digest calcula SHA-256:

```javascript
    verify(header) {
      const parsed = parseCredential(header)
      if (!parsed) return undefined
      if (!available) throw unavailable()
      const record = records.get(parsed.id)
      if (!record || record.revoked || record.expiresAt <= timestamp()) return undefined
      if (!timingSafeEqual(record.digest, digest(parsed.token))) return undefined
      return {
        subject: record.subject,
        tenantId: record.tenantId,
        scopes: [...record.scopes],
      }
    },
```

En el instante exacto expiresAt, la clave ya no vale. Revocar marca el registro y afecta a las siguientes verificaciones. No cancela por la fuerza una operación que ya fue admitida; ese sería otro requisito que necesitaría coordinación con el trabajo activo.

**timingSafeEqual** compara dos digests del mismo tamaño. No convierte toda la ruta HTTP en una operación de tiempo constante: hay búsquedas, condiciones y respuestas diferentes alrededor. No presentamos esa función como solución universal a los canales temporales.

<img src="/assets/visuals/api-contracts/API-THREATS-CREDENTIALS.svg" alt="La cabecera única y acotada permite buscar el identificador. El servidor comprueba registro, caducidad, revocación y digest antes de construir identidad. Después verifica tenant, scope y permiso sobre el recurso, sin tomar identidad del body." width="328" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-THREATS-CREDENTIALS.svg).

## Un scope no sustituye el permiso sobre un documento

La identidad verificada contiene **scopes** como documents:read, documents:write o imports:run. El controlador exige el correspondiente a la operación, pero conserva las comprobaciones anteriores de tenant y recurso.

Tener documents:write no convierte a `sync-north` en propietario de un documento de Alice. La escritura sigue exigiendo owner y estado draft. Tampoco permite pasar a South cambiando la ruta: el tenant del registro debe coincidir con el solicitado.

Así evitamos dos atajos distintos: confiar en una identidad declarada por el cliente y asumir que una identidad válida tiene permiso para todo. El [aislamiento multi-tenant](/posts/autorizacion-multi-tenant-contexto-datos) no desaparece al introducir credenciales mejores.

## Un fallo del almacén no significa que la clave sea válida

Sin credencial válida devolvemos **401**, con una cabecera WWW-Authenticate de desafío Bearer. Una identidad reconocida sin el scope exigido recibe **403**. Los casos de recurso o tenant ajeno conservan la política 404 del laboratorio para no revelar su existencia.

Si el almacén no está disponible, una clave con formato correcto recibe **503**. No podemos verificarla. El error público es genérico y no incluye token, digest o excepción interna. Una entrada que ya es inválida sintácticamente puede rechazarse antes, con 401.

El punto más fácil de pasar por alto está en la integración: cuando inyectamos este verificador, **no** intentamos después las credenciales públicas demo-alice/demo-bob como fallback. Dejar ese segundo camino convertiría la caída del mecanismo nuevo en una forma de volver al antiguo.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/api-threats-credentials/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-threats
```

## Garantías y límites

Consulta el [laboratorio de amenazas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-threats/credentials.mjs), usa Node 24.19.0 o posterior y ejecuta `pnpm test`. No necesita dependencias de aplicación. `tests/credentials.test.mjs` conecta con la API HTTP local usando claves nuevas generadas durante cada test.

Las pruebas incluyen clave válida, alterada, inventada, caducada y revocada; Authorization duplicada; identidad falsa en otras cabeceras; scope ausente; ownership y aislamiento. Comprueban también que un importador no se ejecuta después de un rechazo. Un 401 aislado no bastaría si el trabajo protegido ya hubiera ocurrido.

El registro es efímero, de un proceso y sin persistencia. HTTP sin TLS solo en loopback. No hay altas de clientes, distribución segura inicial, limitación de intentos de autenticación, MFA, custodia de claves o auditoría de infraestructura. Los servidores de ejemplo anteriores mantienen fixtures públicos si no se les inyecta el nuevo adaptador.

No estamos declarando resuelto todo **broken authentication**. Estamos comprobando una frontera concreta de una API para clientes de servicio, con los límites expuestos. En producción, el transporte debe proteger el token y la estrategia de credenciales debe encajar con el sistema de identidad elegido.

## Ejercicio: impedir que una credencial antigua vuelva por otra puerta

Añade un test donde el almacén falla y el cliente intenta sucesivamente una clave válida, demo-alice y una identidad enviada en el body. Exige que ninguna llegue al trabajo protegido y que la clave válida vuelva a funcionar al recuperar el almacén.

Después escribe qué tendría que ocurrir con las solicitudes ya admitidas al revocar. Distingue operaciones breves de trabajos largos antes de decidir si necesitas verificaciones adicionales durante su ejecución.

## Referencias

- [OWASP API2:2023: broken authentication](https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/).
- [Node.js: crypto.randomBytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback).
- [Node.js: crypto.timingSafeEqual y sus límites](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).
- [RFC 9110: autenticación HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#name-authentication).

Fuentes consultadas el 20 de octubre de 2026. El formato lab1 es exclusivo del ejercicio, no un estándar de credenciales.
