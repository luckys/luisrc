---
id: P027
title: 'OAuth y OIDC: entender Authorization Code con PKCE paso a paso'
published: 2026-10-18T04:14:00Z
locale: es
translationKey: oauth-oidc-authorization-code-pkce
slug: oauth-oidc-authorization-code-pkce
draft: true
status: draft
level: intermedio
prerequisites: [P026, API-SESSION-REFRESH]
description: 'Diferencia autorización delegada de autenticación federada y sigue un login real con Authorization Code, PKCE, state y nonce.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, oauth, oidc, pkce]
---

La aplicación recibe un access token y da por hecho que ya sabe quién ha iniciado sesión. El token era válido para consultar otro servicio, pero nadie había definido qué prueba de identidad aceptaría nuestra aplicación. El problema no está en escribir mal una redirección: se han mezclado autorización y autenticación.

**OAuth 2.0** permite obtener acceso limitado a recursos. **OpenID Connect**, u **OIDC**, añade un protocolo de identidad sobre OAuth. Están relacionados, pero no son dos nombres intercambiables para «login con un proveedor».

Después de [sesiones](/posts/sesiones-web-cookies-identidad) y [rotación de tokens](/posts/access-refresh-tokens-rotacion-reutilizacion), vamos a recorrer un Authorization Code flow con **PKCE**. El laboratorio utiliza un proveedor OIDC de test real en loopback. No reemplaza el protocolo por una función que devuelve un usuario fijo ni requiere abrir una cuenta externa.

## Los roles indican dónde termina cada responsabilidad

Imagina una aplicación que pide permiso para leer un calendario. La persona que puede autorizar ese acceso es el **resource owner**. La aplicación que solicita el acceso es el **client**. El **authorization server** emite credenciales bajo una política, y el **resource server** protege el calendario.

Client no significa necesariamente navegador. Un backend también puede ser client. Tampoco exige que authorization server y resource server vivan en la misma aplicación, aunque un proveedor pueda operar ambos. Estas separaciones proceden de los [roles de OAuth](https://www.rfc-editor.org/rfc/rfc6749.html#section-1.1).

Con OIDC llamaremos **OpenID Provider**, u OP, al proveedor de identidad, y **Relying Party**, o RP, a la aplicación que confía en su resultado. En el laboratorio, `oidc-provider` es el OP y nuestro servidor HTTPS actúa como RP.

No hay un servicio de calendario ni una API de negocio protegida en la demo. `/me` consulta la sesión local del RP; no es una prueba de que hayamos implementado un resource server OAuth completo.

## Un ID token y un access token tienen destinatarios distintos

El **ID token** comunica al RP información sobre la autenticación según OIDC. El **access token** sirve para acceder al recurso previsto por el emisor y el servicio que lo acepta. Cambiarlos de lugar puede producir una confusión de tokens aunque ambos parezcan cadenas con claims.

Por eso nuestra demo no usa el access token como documento de identidad ni envía el ID token a una API de pedidos. Valida el ID token y crea una sesión opaca propia. Conserva issuer y sub como identidad local.

El scope **openid** activa la solicitud OIDC. Otros scopes, como profile, solicitan conjuntos definidos de información bajo la política del proveedor; no garantizan que todos los campos existan. Pedir un scope llamado `orders:read` tampoco demuestra autorización sobre cualquier pedido: el resource server debe interpretar el acceso correctamente.

## El inicio guarda secretos antes de redirigir

El RP descubre los endpoints del OP configurado. Después genera un **code_verifier**, su challenge S256, un **state** y un **nonce**. Los guarda en una transacción temporal de cinco minutos asociada a una cookie HttpOnly del navegador.

La URL enviada al proveedor incluye client ID, redirect URI registrada, scope, challenge, state y nonce. El verifier se queda en el RP. No lo colocamos junto al challenge en esa URL, porque dejaría de demostrar que quien canjea el código conserva el secreto inicial.

Este fragmento real de `lab.mjs` construye la solicitud:

```javascript
const location = oidc.buildAuthorizationUrl(config, {
  redirect_uri: `${origin}/callback`,
  scope: 'openid',
  state: flow.state,
  nonce: flow.nonce,
  code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
  code_challenge_method: 'S256',
})
```

La llamada usa `openid-client`; no concatenamos manualmente una query string ni implementamos un cliente OAuth desde cero. La configuración y su comportamiento forman parte del contrato de la librería instalada y probada.

<img src="/assets/visuals/api-contracts/P027.svg" alt="El RP guarda verifier, state y nonce. El navegador lleva el challenge al OP, vuelve con un código y el RP lo canjea con el verifier antes de validar el ID token y crear sesión." width="287" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P027.svg).

## PKCE comprueba una relación entre inicio y canje

El proveedor recibe el challenge en la autorización. En el token endpoint recibe el verifier y comprueba que produce el challenge esperado. Copiar solo el código no debería bastar para canjearlo si no se dispone del verifier correcto.

El test obtiene un código real y trata de canjearlo con un verifier distinto. El proveedor devuelve 400 e `invalid_grant`. No es una comparación que hayamos escrito dentro de nuestro servidor: la ejecuta el OP integrado.

**RFC 7636** define PKCE. La [BCP de OAuth](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1) explica su uso dentro de las protecciones actuales del flujo. No convierte un dispositivo comprometido en seguro ni sustituye HTTPS o el registro correcto de redirect URIs.

Nuestro cliente local se registra como público, sin client secret, y exige PKCE. Eso simplifica el laboratorio; no significa que todo backend de producción deba registrarse así. La autenticación de un cliente confidencial es otra decisión del despliegue, distinta de probar que conserva el verifier.

## State y nonce no son adornos redundantes

**State** permite correlacionar la respuesta con la operación iniciada por este navegador. **Nonce** se envía al OP y se contrasta con el del ID token. En la demo los valores esperados se conservan en el servidor y no se toman de la propia respuesta como si fueran una referencia fiable.

La cookie temporal vincula el callback a ese navegador. Una petición sin ella falla aunque presente una URL de callback. Otra prueba altera state. Una tercera altera el nonce enviado al OP manteniendo el esperado por el RP. Ninguna crea una sesión.

Al procesar el callback consumimos la transacción incluso si termina en error. Repetir la misma URL no reinicia el login anterior. No queremos que un fallo quede convertido en una oportunidad ilimitada de reintentar esa operación con otros valores.

Estos mecanismos responden a amenazas diferentes. La demo usa los tres de forma explícita, sin afirmar que una palabra como PKCE resuelva toda correlación, replay o robo de sesión.

## El navegador lleva un código; el backend obtiene los tokens

Después de la interacción del OP, el navegador vuelve al callback con un **authorization code**. El RP lo canjea directamente con el token endpoint y valida el resultado antes de crear su sesión.

No devolvemos el ID token al JavaScript de la página. El navegador conserva solo la cookie de sesión local. Tampoco guardamos tokens del OP en localStorage ni añadimos una renovación implícita que el laboratorio no pruebe.

La [siguiente entrega](/posts/oidc-validar-id-token-jwks-claims) desarrolla la parte que aún falta en este recorrido: por qué el ID token debe superar comprobaciones de firma, emisor, destinatario y tiempo, además de estar ligado a la transacción.

## Machine-to-machine no es una persona invisible

En una integración **machine-to-machine**, un servicio puede obtener acceso actuando bajo su propia identidad de cliente, por ejemplo mediante client credentials. No hay necesariamente una persona navegando por un formulario ni un ID token que describa su autenticación.

La política debe distinguir al servicio de un usuario delegado. Copiar el mismo `sub` a ambos contextos o inventar un usuario humano para todas las tareas automáticas vuelve ambiguas las auditorías y los permisos.

El grant de client credentials está definido en [RFC 6749, sección 4.4](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.4). Aquí se explica para delimitar roles, pero no está habilitado en la configuración del OP ni se presenta como una integración ejecutada.

## Garantías y límites

El [laboratorio descargable](/assets/examples/api-identidad-lab.zip) utiliza Node 24.19.0, OpenSSL, oidc-provider 9.12.2 y openid-client 6.8.8, con lockfile:

```bash
pnpm install --frozen-lockfile
node --test tests/protocol.test.mjs
pnpm serve
```

Se prueban discovery, autorización, canje, verifier incorrecto, state, nonce y creación de sesión. El OP tiene interacción de desarrollo: el formulario exige rellenar nombre y contraseña ficticios, pero **no verifica la contraseña ni implementa MFA**. No introduzcas credenciales reales.

El RP usa HTTPS autofirmado local; el OP usa HTTP exclusivamente en loopback, con una excepción explícita en el cliente. No es un patrón de transporte para producción. No hay proveedor comercial, cuentas reales, consentimiento empresarial, M2M ni permisos por objeto.

## Ejercicio: localizar cada frontera de confianza

Dibuja qué datos pasan por el navegador y cuáles viajan entre servidores. Después intenta canjear el código con otro verifier y explica por qué falla. No uses como respuesta «porque está cifrado»: identifica qué relación comprueba realmente el proveedor.

Continúa con [validar un ID token usando JWKS y claims esperados](/posts/oidc-validar-id-token-jwks-claims).

## Referencias

- [RFC 6749: roles y grants OAuth](https://www.rfc-editor.org/rfc/rfc6749.html).
- [RFC 7636: PKCE](https://www.rfc-editor.org/rfc/rfc7636.html).
- [RFC 9700: seguridad del authorization code flow](https://www.rfc-editor.org/rfc/rfc9700.html#section-2.1.1).
- [OpenID Connect Core: authentication](https://openid.net/specs/openid-connect-core-1_0.html#Authentication).
- [openid-client: cliente de protocolo y ejemplos](https://github.com/panva/openid-client).
- [oidc-provider: proveedor y configuración](https://github.com/panva/node-oidc-provider).

Fuentes consultadas el 18 de octubre de 2026. La integración es real como protocolo local, no como verificación de una identidad de producción.
