---
id: API-SESSION-REFRESH
title: 'Access y refresh tokens: rotación, reutilización y revocación'
published: 2026-10-18T04:13:00Z
locale: es
translationKey: access-refresh-tokens-rotacion-reutilizacion
slug: access-refresh-tokens-rotacion-reutilizacion
draft: true
status: draft
level: intermedio
prerequisites: [P026]
description: 'Un modelo ejecutable de refresh token rotation: familias, replay, expiración absoluta y carreras entre solicitudes legítimas.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, tokens, autenticacion, jwt]
---

Una aplicación renueva sus credenciales y recibe un refresh token nuevo. Un segundo después llega otra petición con el anterior. Puede ser una copia robada, otra pestaña o un reintento porque se perdió la respuesta. El servidor ve la misma señal: una credencial que ya había consumido.

Ese caso permite entender qué aporta la **rotación** y qué no puede resolver por sí sola. Vamos a seguir una familia de tokens, detectar la reutilización y probar qué sucede con sus descendientes.

La [entrega anterior](/posts/sesiones-web-cookies-identidad) construyó una sesión opaca en una cookie. Ahora usamos un modelo separado en `RefreshFamilies`, dentro del mismo laboratorio. No estamos afirmando que cualquier web con sesiones necesite access y refresh tokens, ni que el RP anterior ya renueve credenciales de un proveedor.

## Dos credenciales con responsabilidades distintas

Un **access token** se presenta ante el servicio protegido. Un **refresh token** se presenta ante el mecanismo de renovación para obtener nuevas credenciales, si sigue autorizado. El segundo no debería circular por cada API de negocio.

En nuestro modelo ambos son aleatorios y opacos. El access dura 60 segundos; la familia renovable tiene un máximo absoluto de 30 minutos. Son valores didácticos, no una política de seguridad universal.

El límite absoluto evita que renovar alargue indefinidamente la familia. Si quedan diez segundos de vida familiar, el access recién creado tampoco obtiene otros sesenta. La función `pair` utiliza el mínimo entre su TTL y el límite de la familia.

Los roles de access y refresh no obligan a un formato concreto. El [marco OAuth](https://www.rfc-editor.org/rfc/rfc6749.html#section-1.5) define su propósito; nuestro ejercicio modela el estado de renovación, pero no implementa sus endpoints ni todos sus requisitos.

## Opaco y JWT responden a una pregunta diferente

**JWT** describe un formato de claims. Un token opaco normalmente requiere resolver información mediante el emisor o un almacén. Un JWT firmado puede permitir comprobaciones locales si existe una política de confianza adecuada.

No hay una equivalencia «sesión = cookie» y «token = JWT». La cookie anterior transportaba un token opaco de sesión. Un access token también puede ser opaco; un JWT puede utilizarse en otro contexto, como un ID token de OIDC.

Una firma no cifra el contenido. Tampoco responde si una credencial fue revocada después de emitirse. **RFC 7519** define el formato y sus claims; la [validación de identidad del siguiente bloque](/posts/oidc-validar-id-token-jwks-claims) mostrará cómo limitar su aceptación.

Aquí elegimos estado consultado en cada autenticación para observar inmediatamente una revocación familiar. Ese resultado no se puede atribuir a un JWT que otro servicio siga aceptando offline hasta `exp`.

## Rotar significa consumir, no solo emitir otro token

La estructura conserva familias, access tokens y refresh tokens. Los dos últimos se indexan por hash. Cada refresh indica su familia y si ya se ha utilizado. Cada access indica familia y fecha de expiración.

El paso relevante está en `state.mjs`:

```javascript
  rotate(token) {
    const record = this.refresh.get(digest(token))
    if (!record || !this.live(record.familyId)) throw new Error('invalid_refresh')
    if (record.used) {
      this.families.get(record.familyId).revoked = true
      throw new Error('refresh_reuse')
    }
    record.used = true
    return this.pair(record.familyId)
  }
```

Si no conocemos el token o la familia ya terminó, no renovamos. Si el token sigue sin usar, lo marcamos como consumido y generamos el sucesor. Si estaba consumido, revocamos la familia.

Conservar la marca del anterior es lo que permite reconocer un **replay**. Borrar inmediatamente todo rastro convertiría una reutilización detectable en una credencial simplemente desconocida. Ese historial también cuesta espacio y necesita una política de limpieza al finalizar el plazo pertinente.

<img src="/assets/visuals/api-contracts/API-SESSION-REFRESH.svg" alt="R0 se consume y produce R1. Si R0 vuelve a presentarse, se revoca la familia y dejan de aceptarse tanto R1 como sus access tokens." width="245" height="815" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-SESSION-REFRESH.svg).

## La prueba debe llegar hasta los descendientes

El test crea un primer par, rota su refresh y autentica con el access nuevo. Después reutiliza el refresh original. La llamada falla con `refresh_reuse`.

No nos detenemos en esa excepción. Comprobamos que ya no se acepta el access original, tampoco el nuevo y tampoco puede renovarse con el refresh sucesor. Así probamos la política familiar, no solo una condición dentro de una función.

Otra familia sigue funcionando. Revocar a Alice no debe cerrar automáticamente la sesión de Bob. En este modelo una misma persona puede tener varias familias, y revocar una no representa un cierre global de todas sus sesiones.

La [BCP de seguridad de OAuth](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14) explica la rotación y los tokens vinculados al emisor de la petición como mecanismos para abordar el replay de refresh. No implementamos DPoP ni mutual TLS aquí: la familia es una elección didáctica concreta.

## Una carrera legítima puede parecer un ataque

Dos tareas del test intentan renovar con el mismo token. La primera recibe credenciales nuevas; la segunda encuentra el anterior consumido y revoca la familia. Al comprobar el access de la primera, también falla.

Este resultado es coherente con nuestra política estricta, pero tiene un coste de experiencia de usuario. Una respuesta perdida seguida de un reintento podría exigir iniciar sesión de nuevo. No hemos demostrado distinguir a un atacante de una pestaña legítima.

Coordinar renovaciones en el cliente o en un backend puede reducir duplicados, pero una ventana de tolerancia cambia el modelo de riesgo. No añadimos un período de gracia sin definir qué credenciales se devuelven, durante cuánto tiempo y qué reutilizaciones seguirían detectándose.

Además, `rotate` es síncrona y no contiene `await`. Las operaciones no se intercalan dentro de este proceso Node. Dos promesas no equivalen a dos servidores con una base compartida. Allí la transición necesitaría una actualización condicional o transacción que impida consumir el mismo registro dos veces.

## Expirar y revocar no son la misma decisión

La expiración aplica un límite temporal. La revocación cambia el estado antes de que llegue ese límite, por logout, sospecha de robo u otra política.

Los tests utilizan un reloj inyectado: un access deja de funcionar al alcanzar su TTL, un refresh todavía puede renovarlo antes del límite familiar y esa renovación no desplaza la fecha máxima. En el instante exacto de expiración, ambos caminos fallan.

Nuestra función `revoke` trabaja sobre el estado del modelo. No es el endpoint de revocación de **RFC 7009**, que define comportamiento de protocolo para clientes OAuth. Tampoco borra una credencial ya copiada: evita que esta implementación siga aceptándola.

Los tokens de tipo **bearer** autorizan por posesión; proteger su transporte y evitar filtraciones importa tanto como su caducidad. La [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html) describe ese uso. No ponemos tokens reales en ejemplos de URLs, capturas o logs.

## Garantías y límites

Descarga el [laboratorio de identidad](/assets/examples/api-identidad-lab.zip) y ejecuta:

```bash
pnpm install --frozen-lockfile
node --test tests/state.test.mjs
```

Los seis tests de estado cubren sesiones y familias. La rotación se prueba como modelo de estado, no por un endpoint OAuth expuesto al navegador. El RP HTTPS del bloque anterior no usa estos refresh tokens ni afirma renovar el access token de su OP.

No hay almacenamiento persistente, recolector completo de registros, sender-constrained tokens, rotación distribuida ni protocolo de recuperación ante respuestas perdidas. Las consultas de autenticación revisan estado en memoria. Este laboratorio no debe convertirse en proveedor de identidad de producción copiando sus clases.

## Ejercicio: especificar un reintento antes de programarlo

Describe qué sucedería si la primera renovación se completa pero su respuesta no llega al cliente. Indica qué conserva cada lado y qué devuelve el reintento con la política actual. Después escribe un test de esa secuencia.

Si propones tolerar el reintento, explica también cómo evitarías que una copia robada disfrutara de la misma tolerancia. El siguiente artículo estudia [OAuth, OIDC y Authorization Code con PKCE](/posts/oauth-oidc-authorization-code-pkce), donde intercambiar credenciales introduce nuevas fronteras de confianza.

## Referencias

- [RFC 6749: refresh tokens](https://www.rfc-editor.org/rfc/rfc6749.html#section-1.5).
- [RFC 9700: protección de refresh tokens](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519.html).
- [RFC 6750: bearer tokens](https://www.rfc-editor.org/rfc/rfc6750.html).
- [RFC 7009: revocación OAuth](https://www.rfc-editor.org/rfc/rfc7009.html).

Fuentes consultadas el 18 de octubre de 2026. La revocación inmediata descrita corresponde al modelo stateful ejecutado, no a todos los sistemas basados en tokens.
