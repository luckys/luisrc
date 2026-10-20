---
id: P026
title: 'Sesiones web: mantener la identidad sin exponerla en cada petición'
published: 2026-10-18T04:12:00Z
locale: es
translationKey: sesiones-web-cookies-identidad
slug: sesiones-web-cookies-identidad
draft: true
status: draft
level: intermedio
prerequisites: [P008, P009, P020]
description: 'Cómo funciona una sesión opaca: estado en servidor, cookies HttpOnly y SameSite, rotación, expiración y logout verificable.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [api, seguridad, autenticacion, sesiones, cookies]
---

Pulsar «cerrar sesión» elimina la cookie y la interfaz vuelve a mostrar el formulario de acceso. Parece suficiente, hasta que una copia de esa cookie sigue permitiendo consultar la cuenta desde otro navegador.

Ese fallo tiene una causa concreta: borrar una credencial del dispositivo no demuestra que el servidor haya dejado de aceptarla. Para entender la diferencia vamos a construir una **sesión stateful**, probar su caducidad y comprobar el logout con una copia de la credencial.

Esta entrega abre el bloque de identidad de la serie. Después de estudiar [contratos HTTP](/posts/api-contrato-esquema-clientes), necesitamos decidir qué reconoce el servidor cuando llega una petición. Los permisos sobre cada recurso vendrán después: saber quién accede no significa que pueda leer cualquier pedido.

## Autenticar una vez, reconocer las siguientes peticiones

La **autenticación** comprueba una identidad mediante un mecanismo aceptado: por ejemplo, un proveedor externo con sus propias verificaciones. La **sesión** conserva el resultado durante un tiempo y permite relacionarlo con peticiones posteriores.

En nuestro laboratorio, el backend recibe una identidad validada mediante OIDC y crea una sesión local. El navegador no envía la contraseña al backend en cada consulta. Presenta un identificador aleatorio; el servidor busca el registro correspondiente y decide si sigue vigente.

El login con el proveedor se desarrolla en [OAuth y OIDC](/posts/oauth-oidc-authorization-code-pkce). Aquí seguimos el recorrido desde que ya se ha comprobado la identidad. No vamos a inventar una comprobación de contraseña para rellenar ese paso ni a presentar el formulario de desarrollo como un sistema de acceso real.

## El identificador es una credencial, no el número del usuario

El servidor genera 32 bytes aleatorios con `randomBytes` y los representa en **base64url**. El resultado es un **token opaco**: el cliente no necesita interpretarlo. No contiene un JSON con el nombre, los permisos o la fecha de nacimiento.

Opaco no significa inofensivo. Quien consiga una copia puede intentar presentarla mientras sea válida. Por eso no se coloca en la URL, no se imprime en logs y no se usa como dato de analítica.

El almacenamiento utiliza un **hash SHA-256** del identificador como clave. Este hash sirve para buscar un secreto aleatorio de alta entropía sin conservar su representación original en ese registro. No es una receta para almacenar contraseñas humanas: tienen otras propiedades y requieren mecanismos específicos.

La función de `state.mjs` crea el registro y elimina la sesión anterior que se le haya indicado:

```javascript
  establish(identity, previous) {
    this.revoke(previous)
    const token = secret()
    this.records.set(digest(token), {
      identity: { ...identity }, expiresAt: this.clock() + this.ttl,
    })
    return token
  }
```

El test conserva el identificador anterior, establece otra sesión y comprueba que el primero ya no funciona. Así observamos la rotación frente a **session fixation**: el login no debe limitarse a elevar los privilegios de un identificador previamente conocido por otra persona. OWASP describe esta separación entre identidad y gestión de sesión en su [guía de sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

<img src="/assets/visuals/api-contracts/P026.svg" alt="Tras validar la identidad, el backend crea una sesión opaca y devuelve una cookie. Las peticiones consultan el estado, y logout revoca el registro antes de borrar la cookie." width="305" height="876" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P026.svg).

## La cookie transporta la credencial con reglas del navegador

El RP, la aplicación que recibe la identidad, devuelve `__Host-sid` con **Path=/**, **HttpOnly**, **Secure** y **SameSite=Lax**, sin atributo Domain. El prefijo `__Host-` impone restricciones de ámbito en navegadores compatibles: no basta con escribir ese nombre sin cumplir sus condiciones.

**HttpOnly** impide leer la cookie con `document.cookie`; no impide que una página comprometida haga peticiones autenticadas. **Secure** limita su envío a conexiones seguras. **SameSite** regula cuándo se envía en peticiones entre sitios; no es un sistema de permisos ni una garantía completa contra CSRF. Los detalles de cada atributo están en [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Elegimos Lax porque este ejemplo vuelve del proveedor mediante una navegación GET de nivel superior. No se debe copiar esa elección sin revisar el flujo: otro response mode, una aplicación embebida o una integración entre sitios cambia las condiciones.

Tampoco confundimos **site** con **origin**. Nuestro logout exige que el header Origin coincida exactamente con el de la aplicación. El test envía un origen ajeno y otro ausente: ambos reciben 403. Es una defensa concreta para esa operación, no la implementación de todas las protecciones del navegador. El bloque posterior de XSS y CSRF ampliará esos ataques.

## La expiración se decide en el servidor

La cookie dura 30 minutos y el registro tiene una expiración absoluta equivalente. La autoridad para aceptar la sesión está en el servidor, no en que el navegador conserve todavía el texto de una cookie.

Un test inyecta un reloj: crea una sesión en el instante 1000 con TTL 100 y consulta en 1100. La consulta devuelve `null`. No esperamos cien milisegundos reales ni dependemos de la velocidad de la máquina. Ese reloj permite comprobar exactamente el límite.

No hay **idle timeout** deslizante en esta implementación. Leer `/me` no añade otros treinta minutos. Si el producto necesitara caducidad por inactividad y una duración máxima, tendríamos que representar ambas reglas y probarlas por separado.

Una sesión stateful facilita revocar un registro, pero exige consultar estado compartido cuando hay varios procesos. Cambiar Map por otro almacén no es solo sustituir una clase: hay que decidir consistencia, expiración, disponibilidad y comportamiento si el almacén falla.

## Logout necesita dos acciones distintas

El POST `/logout` elimina el registro y devuelve una cookie con Max-Age=0. La primera acción impide que el backend acepte una copia; la segunda pide al navegador que deje de enviar la suya.

La prueba copia de verdad el valor a un contexto independiente antes de salir. Después consulta `/me` desde ese contexto y recibe 401. Si solo observáramos que desaparece la cookie del navegador original, no habríamos probado la revocación del servidor.

Este logout es **local**. El proveedor mantiene su propia sesión y podría permitir otro acceso sin volver a pedir credenciales. Cerrar la sesión del RP y cerrar la del proveedor son operaciones distintas. La demo no implementa single logout ni promete cerrar todas las sesiones de la persona.

## Una cookie de sesión no demuestra MFA

La sesión recuerda un resultado; no mejora retroactivamente el mecanismo utilizado para obtenerlo. En este laboratorio el proveedor de desarrollo acepta un nombre ficticio, sin comprobar contraseña ni segundo factor.

**MFA** combina factores independientes. Pedir dos secretos memorizados no equivale a combinar conocimiento con posesión. Además del acceso inicial, importan el registro de factores, la recuperación y cuándo exigir una autenticación reciente para operaciones sensibles. La [guía de MFA de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) trata esas decisiones.

No añadimos `mfa: true` a un registro para aparentar esa garantía. Un sistema real necesitaría evidencia del proveedor y una política que supiera interpretarla. Tampoco usamos el email como sustituto universal de un identificador estable: aquí conservamos **issuer y sub**.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p026/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/api-identity
```

## Garantías y límites

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/api-identity/state.mjs) contiene `state.mjs`, el RP HTTPS, un proveedor OIDC local y sus tests:

```bash
pnpm install --frozen-lockfile
node --test tests/state.test.mjs tests/protocol.test.mjs
pnpm serve
```

Necesita Node 24.19.0 y OpenSSL. El certificado autofirmado y las claves se generan temporalmente. Solo escucha en loopback. No requiere cuenta externa ni API key; tampoco debe exponerse a Internet.

Los tests Node verifican estado y protocolo. Una comprobación adicional del repositorio usa Chromium para observar las flags de la cookie, su ausencia en `document.cookie` y la invalidez de una copia tras logout. No es una auditoría completa de seguridad.

Map pierde las sesiones al reiniciar y no tiene recolección completa ni límites de memoria para carga real. No hay permisos por recurso, recuperación de cuenta ni MFA implementados. El ejercicio de refresh tokens del siguiente artículo es complementario: no está conectado a esta cookie.

## Ejercicio: distinguir sesión vencida de cookie ausente

Amplía el test de reloj para probar un instante justo anterior a la expiración y otro justo después. Conserva una copia del token en ambos casos. Después decide qué mensaje debería mostrar la interfaz sin revelar detalles internos al cliente.

Continúa con [access tokens, refresh y revocación](/posts/access-refresh-tokens-rotacion-reutilizacion), donde una credencial breve y otra renovable obligan a decidir qué ocurre cuando reaparece un token ya usado.

## Referencias

- [OWASP: gestión de sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
- [OWASP: multifactor authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

Fuentes consultadas el 18 de octubre de 2026. Los tiempos y decisiones del laboratorio son explícitos, no valores recomendados para cualquier aplicación.
