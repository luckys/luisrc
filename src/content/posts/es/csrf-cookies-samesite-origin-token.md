---
id: API-BROWSER-CSRF
title: 'CSRF: por qué una cookie válida no demuestra que el usuario quiso actuar'
published: 2026-10-18T04:21:00Z
locale: es
translationKey: csrf-cookies-samesite-origin-token
slug: csrf-cookies-samesite-origin-token
draft: true
status: draft
level: intermedio
prerequisites: [P029, P026]
description: 'Reproduce un formulario CSRF local, distingue same-site de same-origin y protege una mutación con Origin y un token aleatorio ligado a la sesión.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, csrf, cookies, navegador, testing]
---

El servidor reconoce la sesión y cambia el título. Lo que no ha comprobado es que la petición naciera de la aplicación: un formulario de otra página la envió aprovechando que el navegador adjunta cookies automáticamente.

Ese es el problema de **CSRF**, Cross-Site Request Forgery. La credencial puede ser válida y la operación no haber sido solicitada desde el flujo que esperábamos. No hace falta que el otro origen pueda leer la respuesta para que se produzca un cambio.

Seguimos usando el laboratorio local del [artículo de XSS](/posts/xss-dom-texto-html-contextos). Aquí no inyectamos código en nuestra página: el intento parte de un documento servido por otro origen. Esta diferencia determina qué defensas tienen sentido.

## La cookie identifica una sesión, no la intención de una acción

Una cookie que acompaña a una petición puede permitir al servidor encontrar la sesión. No explica por sí sola qué página inició la acción ni si el usuario entendió sus consecuencias.

El navegador decide cuándo enviarla según el destino y sus atributos. Un formulario HTML puede enviar un POST con application/x-www-form-urlencoded a otra ubicación sin necesitar que el script lea la respuesta mediante fetch.

Por eso mantenemos **GET sin efectos de negocio** y protegemos las mutaciones. Cambiar el nombre de una ruta o esconder el botón no impide construir otra petición HTTP. Del mismo modo, exigir login atiende la identidad, no esta inducción del navegador.

El ejemplo usa un título ficticio, no transferencias ni datos de usuarios. La ruta unsafe acepta una sesión y cambia ese título. La ruta safe añadirá comprobaciones antes de producir el efecto.

## Same-origin y same-site responden preguntas diferentes

Un **origin** se identifica por esquema, host y puerto. Cambiar el puerto de un servidor local crea otro origen. Un **site** se calcula con el esquema y el dominio registrable, o el host en los casos pertinentes; el puerto no lo separa.

Por eso dos servidores HTTP en 127.0.0.1, con puertos distintos, son cross-origin pero same-site. En el laboratorio, el formulario servido desde el segundo puerto demuestra que **SameSite=Lax** no bloquea todas las peticiones de otros orígenes.

La prueba complementaria visita el mismo servidor de formularios mediante localhost y envía a 127.0.0.1. Ahí hemos cambiado de site. En Chromium, ese POST de navegación no lleva la cookie Lax explícita y la ruta responde 401. Es un resultado de ese flujo, no una promesa para cualquier método o navegación.

La distinción está explicada en [same-site y same-origin de web.dev](https://web.dev/articles/same-site-same-origin). Ayuda también a entender por qué un subdominio bajo un mismo site puede seguir siendo una frontera importante de confianza.

Los puertos tampoco aíslan cookies. Los servidores locales de esta demo comparten host y están controlados por el test; no registran ni reutilizan las cookies recibidas. Sirven para observar la política de origen y el envío automático, no para demostrar confidencialidad de sesión entre servicios hostiles en el mismo host.

## Un formulario local reproduce el efecto antes de corregirlo

Descarga el [laboratorio del navegador](/assets/examples/api-navegador-lab.zip) y ejecuta, desde su carpeta:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm serve
```

Abre primero la URL de sesión ficticia que imprime el terminal. Después abre el formulario local con target=unsafe y pulsa su botón. El navegador navega al resultado y el título pasa a «Desde otro origen».

Repite con target=safe. Ahora recibes 403 y el título anterior se conserva. El test vuelve a leer el estado desde la aplicación para comprobarlo: no considera suficiente una respuesta de denegación si el servidor ya hubiese escrito antes.

La ruta de sesión es una fixture abierta que genera un identificador opaco aleatorio y un token CSRF independiente. No verifica contraseña, OIDC o MFA. Nunca debe copiarse como login ni publicarse junto al resto de rutas vulnerables.

## Origin y un token ligado a la sesión comprueban propiedades distintas

Elegimos un contrato cerrado de navegador. La mutación requiere el **Origin exacto** de la aplicación y un **token CSRF** aleatorio guardado en esa sesión. La ausencia de Origin o el valor null no se convierten en excepciones permisivas.

La función de `lab.mjs` es esta:

```javascript
export function validMutation(request, session, app, csrf) {
  if (request.headers.origin !== app) return false
  if (typeof csrf !== 'string' || !/^[a-f0-9]{48}$/.test(csrf)) return false
  return timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))
}
```

El token se obtiene desde `/api/token` con una petición de la propia aplicación. El servidor no habilita lectura CORS de esa ruta. Una página de otro origen no recibe el secreto simplemente por saber su URL; sigue haciendo falta revisar XSS y cualquier otra vía de exposición.

La comparación de Origin es una igualdad con el origen configurado por el servidor, incluidos esquema y puerto. No usamos contains ni aceptamos un dominio que solo empieza por el nombre esperado. En un despliegue con proxy habría que establecer explícitamente cuál es el origen público confiable, sin construirlo a partir de headers arbitrarios.

El token contiene 24 bytes aleatorios en hexadecimal. Comprobar su formato antes de timingSafeEqual no es un detalle ornamental: una prueba con caracteres no ASCII encontró una excepción por tamaños de buffer diferentes. La corrección rechaza esa entrada con 403, sin producir una respuesta 500.

No guardamos el token en la URL. Acabaría en lugares donde no queremos secretos, como historiales o registros de acceso. Tampoco es el identificador de sesión: conocer el token CSRF no debe servir como mecanismo alternativo de login.

<img src="/assets/visuals/api-contracts/API-BROWSER-CSRF.svg" alt="Un formulario de otro origen induce un POST con cookie cuando la política lo permite. La ruta vulnerable escribe; la protegida exige sesión, Origin exacto y token CSRF de esa sesión antes de cambiar el título." width="299" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-BROWSER-CSRF.svg).

## SameSite y los demás atributos de cookie son capas, no equivalentes

**HttpOnly** impide la lectura habitual de esa cookie desde JavaScript. **Secure** restringe su envío al canal seguro conforme al comportamiento del navegador. **SameSite** introduce condiciones relacionadas con el site. Ninguno expresa la política de permisos por documento del backend.

Lax puede permitir cookies en determinadas navegaciones de nivel superior; Strict restringe más y puede afectar flujos legítimos. None se utiliza cuando el caso necesita envío cross-site, con los requisitos y políticas de cookies aplicables. No elegimos el valor solo para que desaparezca un error de desarrollo.

Nuestra cookie usa Lax explícito, HttpOnly y Path=/, sin Domain. Omite Secure porque el sandbox es HTTP de loopback. En una aplicación publicada hay que usar HTTPS y revisar alcance, caducidad y prefijos de cookie apropiados. [MDN documenta estos atributos de Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

La defensa token más Origin sigue siendo relevante aunque el producto elija Lax. Y si necesitas clientes no navegador, diseña su autenticación y contrato aparte; no conviertas «sin Origin» en un acceso universal a esta ruta de sesión.

## XSS y autorización siguen siendo problemas separados

Un XSS en el origen legítimo puede obtener el token CSRF y enviar una petición desde ese mismo origen. Haber implementado esta comprobación no corrige el sink de HTML del primer artículo.

Tampoco da permiso para editar un documento ajeno. Tras verificar sesión y procedencia de la mutación, una aplicación real aún debe evaluar [autorización por recurso](/posts/autorizacion-rbac-abac-permisos-recursos). Cada control responde a una pregunta distinta; no son sustitutos entre sí.

La guía de [prevención CSRF de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) describe el patrón de token ligado a sesión y el uso de comprobaciones adicionales. Aquí hemos elegido una combinación concreta para poder probarla, no todas las alternativas.

## Garantías y límites

`pnpm test` ejecuta casos de navegador para formulario same-site, formulario cross-site y mutación legítima con token. Los tests HTTP añaden ausencia de sesión, origen ausente, null, origen incorrecto, token inventado, token de otra sesión y estado posterior intacto.

Los datos viven en memoria y la sesión expira a los 30 minutos. No hay persistencia, logout completo, rotación de sesión, proxies ni múltiples instancias. No hemos probado otros navegadores ni políticas de cookies de terceros. El laboratorio complementa el bloque de sesiones, no lo integra en una aplicación de producción.

## Ejercicio: una ruta nueva necesita conservar el contrato

Añade una acción para archivar el título ficticio. Empieza por un control positivo y otro que envíe el formulario desde el origen de pruebas. Exige que la denegación mantenga el estado, no solo que devuelva 403.

Después intenta leer la respuesta de la ruta vulnerable mediante fetch desde el otro origen. El [siguiente artículo de SOP y CORS](/posts/cors-sop-preflight-no-autorizacion) explica por qué una lectura bloqueada puede coexistir con una escritura ya realizada.

## Referencias

- [web.dev: same-site y same-origin](https://web.dev/articles/same-site-same-origin).
- [MDN: atributos de Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
- [OWASP: prevención de CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Fuentes consultadas el 19 de octubre de 2026. Las dos variantes de site se comprueban en Chromium, con cookies Lax explícitas.
