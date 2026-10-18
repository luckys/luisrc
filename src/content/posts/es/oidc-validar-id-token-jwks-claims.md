---
id: API-OIDC-VALIDATION
title: 'Validar un ID token: firma, JWKS y claims que tu aplicación espera'
published: 2026-10-18T04:15:00Z
locale: es
translationKey: oidc-validar-id-token-jwks-claims
slug: oidc-validar-id-token-jwks-claims
draft: true
status: draft
level: intermedio
prerequisites: [P027]
description: 'Prueba un ID token de OIDC y sus fallos: firma, issuer, audience, exp, iat, nonce, sub y azp con un proveedor local real.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, oidc, jwt, testing]
---

Un token se decodifica y muestra `sub: alice`. Otro añade una fecha de expiración futura. Un tercero viene firmado con una clave que alguien controla. Ninguno de esos hechos, por separado, demuestra que nuestra aplicación deba aceptar la identidad.

Después de recorrer [Authorization Code con PKCE](/posts/oauth-oidc-authorization-code-pkce), nos queda la decisión que realmente abre una sesión: comprobar que el resultado pertenece al proveedor, cliente y operación que esperábamos.

Vamos a probarlo con el mismo OP local y su endpoint **JWKS**. El caso válido debe funcionar; después cambiaremos una condición cada vez. Así distinguiremos una garantía comprobada de una casilla marcada porque «la librería soporta JWT».

## Leer el payload no valida su contenido

**Decodificar** transforma una representación en datos legibles. **Verificar** comprueba condiciones de confianza. Leer el JSON de un JWT no demuestra quién lo emitió ni para quién estaba destinado.

En esta demo el ID token es un JWT firmado con **RS256**. El proveedor conserva la clave privada y publica las claves públicas pertinentes en su JWKS. El RP usa una librería criptográfica para comprobar la firma: no reimplementamos RSA ni comparamos cadenas con un hash inventado.

El contenido firmado sigue siendo legible. Por tanto, no colocamos secretos dentro del token suponiendo que la firma los oculta. Tampoco publicamos tokens completos de sesiones reales como ejemplos para un depurador externo.

## Las claves se obtienen de un proveedor previamente elegido

El RP parte de un **issuer** configurado. Discovery permite obtener sus endpoints y la dirección del JWKS. La configuración del ejemplo es local y conocida; no toma una URL del token recibido para decidir a qué servidor confiar o conectarse.

El campo **kid** ayuda a seleccionar una clave dentro del conjunto confiable. No convierte por sí mismo una clave en confiable. La política se establece antes de aceptar el contenido del token, no después de leer que este dice proceder de alguien conocido.

`createRemoteJWKSet` de **jose** utiliza el JWKS real del OP. Las pruebas negativas no reemplazan esa comprobación por un booleano. Crean tokens de test y los verifican contra las claves publicadas por ese proveedor.

## Firma, emisor y destinatario son comprobaciones distintas

La firma responde si el token coincide con una clave aceptada. **iss**, el issuer, responde si afirma proceder del emisor configurado. **aud**, la audience, indica el destinatario previsto. No basta con que exista alguna firma válida en algún ecosistema.

Un token correctamente firmado para otro cliente no se vuelve aceptable porque reconozcamos el proveedor. Del mismo modo, utilizar una clave esperada no permite ignorar un issuer distinto del configurado.

Limitamos los algoritmos a RS256 en este ejemplo. No dejamos que una entrada no confiable convierta automáticamente cualquier algoritmo anunciado en una opción aceptable. Las [buenas prácticas de JWT](https://www.rfc-editor.org/rfc/rfc8725.html) explican por qué las reglas de validación deben evitar confusiones entre usos y algoritmos.

El núcleo de `identity.mjs` establece esta política:

```javascript
const { payload } = await jwtVerify(token, jwks, {
  issuer,
  audience,
  algorithms: ['RS256'],
  requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp', 'nonce'],
  maxTokenAge: '10m',
  clockTolerance: 0,
})
```

El código es un extracto del laboratorio probado. La política completa también comprueba nonce, sub y azp antes de devolver los claims. No se puede copiar solo esta llamada y concluir que se ha implementado todo OIDC.

<img src="/assets/visuals/api-contracts/API-OIDC-VALIDATION.svg" alt="El token pasa por firma y algoritmo, issuer y audience, límites temporales, nonce y sujeto antes de establecer una sesión. Un fallo en cualquier paso impide crearla." width="279" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-OIDC-VALIDATION.svg).

## El tiempo forma parte de la política de aceptación

**exp** marca la expiración. **iat** indica cuándo se emitió el token. La demo exige ambos y limita la antigüedad aceptada a diez minutos, además de aplicar exp. Si existe nbf, la librería también considera su restricción temporal.

No permitimos tolerancia de reloj en este laboratorio: usamos una sola máquina y queremos fallos nítidos en los tests. Un despliegue distribuido necesitaría relojes sincronizados y una tolerancia pequeña, deliberada y probada, no varios minutos añadidos para hacer desaparecer cualquier error.

La vida de este ID token no es automáticamente la de la sesión local. Después de validar el resultado, el RP crea otra credencial con su propia caducidad de treinta minutos. Tampoco la expiración del ID token implementa logout del proveedor o revocación de una sesión ya creada.

Ese detalle evita un error habitual: presentar tres tiempos distintos como si fueran el mismo. La transacción de login dura cinco minutos, la política limita la antigüedad del ID token y la sesión tiene un plazo propio. Cada regla se aplica en una fase distinta.

## Nonce y azp completan la vinculación del resultado

**Nonce** debe coincidir con el valor guardado al iniciar esta operación. No lo elegimos leyendo el propio token que queremos validar. La comprobación evita aceptar un resultado que no pertenece a la transacción esperada.

**sub** debe ser un identificador no vacío. Lo guardamos junto al issuer: dos proveedores pueden utilizar el mismo texto de sub sin representar a la misma persona. El email, si existiera, no sustituiría automáticamente esa pareja.

**azp**, authorized party, recibe otra comprobación: si está presente, debe identificar a nuestro cliente. Si hay varias audiences, nuestra política también exige azp. Son reglas explícitas para este RP y su contrato con el OP, no campos decorativos que conservamos sin interpretar.

La [sección de validación del ID token de OIDC](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation) explica los requisitos del protocolo. Las claims de contexto de autenticación, como acr o amr, necesitarían además una política acordada con el proveedor. Esta demo no demuestra MFA leyendo una cadena que diga `mfa`.

## No asumir que todo cliente verifica la firma de la misma forma

El RP usa `authorizationCodeGrant` de **openid-client** para procesar la respuesta, enviar el verifier y comprobar state y nonce. Después llama explícitamente a `verifyIdentityToken` con **jose** y las claves del OP.

Esta segunda llamada es intencionada. La documentación de openid-client distingue las comprobaciones de no repudio de la confianza en la respuesta recibida por el token endpoint. La librería también ofrece `enableNonRepudiationChecks`. Aquí escogemos una verificación explícita para hacer visible y probar la política de firma y claims del ejemplo.

No concluimos que las librerías sean inseguras ni que todos sus defaults sean equivalentes. Leemos el contrato de la versión fijada y comprobamos qué valida nuestro recorrido concreto. El resultado importante es que la sesión solo se crea después de esa validación.

## Una prueba negativa cambia una condición cada vez

El test primero firma un token de fixture con la clave efímera del OP y comprueba que se acepta. Después utiliza otra clave privada manteniendo el mismo kid: la firma debe fallar contra el JWKS confiable.

Otras variantes conservan una firma válida, pero cambian issuer, audience, expiración, nonce, sujeto o azp. También se prueba un token sin exp y otro emitido en el futuro. Así no atribuimos todos los rechazos a una firma incorrecta.

Las claves de fixture se crean dentro del test y no se publican por HTTP. Tener acceso de test a ellas permite fabricar casos adversariales; no representa que un atacante pueda pedirle al proveedor que firme cualquier identidad en producción.

El test de protocolo, por su parte, recorre el flujo auténtico de autorización y obtiene un ID token del OP. Los dos tipos de prueba se complementan: una integración feliz no cubre todas las reglas, y un conjunto de JWTs sintéticos no demuestra que el login esté integrado.

## Garantías y límites

Ejecuta el [laboratorio](/assets/examples/api-identidad-lab.zip):

```bash
pnpm install --frozen-lockfile
node --test tests/protocol.test.mjs
```

Las cuatro pruebas de protocolo incluyen varias variantes adversariales. Usan HTTP para el OP solo en loopback y HTTPS autofirmado para el RP. El cliente HTTP de tests confía en ese certificado concreto, no desactiva la validación TLS globalmente.

No se ha probado rotación operativa de claves, indisponibilidad prolongada de JWKS, múltiples emisores, sincronización entre máquinas o recuperación de cuenta. Tampoco hay resource server ni autorización por objeto. Validar identidad no decide si Alice puede modificar un documento de Bob.

## Ejercicio: un token válido para otra aplicación

Mantén firma, issuer, fechas y nonce correctos, pero cambia únicamente audience. Ejecuta el test y explica qué error de diseño aparecería si se eliminara esa comprobación. Después localiza la línea que impediría crear la sesión.

El siguiente bloque del roadmap estudiará permisos sobre recursos y tenant context. Estas cuatro entregas desarrollan P026 y P027; no completan todavía toda la serie de seguridad web.

## Referencias

- [OpenID Connect Core: ID token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).
- [RFC 8725: JWT best current practices](https://www.rfc-editor.org/rfc/rfc8725.html).
- [jose: jwtVerify](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md).
- [openid-client 6.8.8: enableNonRepudiationChecks](https://github.com/panva/openid-client/blob/v6.8.8/docs/functions/enableNonRepudiationChecks.md).

Fuentes consultadas el 18 de octubre de 2026. Las garantías corresponden a los casos ejecutados y a la política explícita del RP de pruebas.
