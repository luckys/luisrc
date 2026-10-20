---
id: API-BROWSER-CORS
title: 'CORS y SOP: bloquear la lectura de una respuesta no autoriza una API'
published: 2026-10-18T04:22:00Z
locale: es
translationKey: cors-sop-preflight-no-autorizacion
slug: cors-sop-preflight-no-autorizacion
draft: true
status: draft
level: intermedio
prerequisites: [P029, API-BROWSER-CSRF]
description: 'Observa CORS en Chromium: peticiones simples con efectos, preflight real, credenciales y wildcard. Contrasta la lectura del navegador con un cliente HTTP autenticado.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, navegador, cors, http, api, testing]
---

Fetch termina con un error CORS, pero el título del servidor ha cambiado. El navegador ha impedido al script leer la respuesta, no ha deshecho la petición que ya llegó.

Esta observación separa dos decisiones que suelen mezclarse: qué puede leer un origen desde el navegador y qué operación permite ejecutar el servidor a una identidad. Vamos a comprobarlas por separado, incluyendo un caso donde el **preflight** sí impide enviar la petición posterior.

Necesitamos la distinción entre site y origin del [artículo de CSRF](/posts/csrf-cookies-samesite-origin-token). Los tres servidores principales del laboratorio tienen el mismo esquema y host, pero puertos diferentes: son same-site y cross-origin.

## SOP protege la separación entre orígenes del navegador

La **Same-Origin Policy**, SOP, restringe cómo un documento o script de un origen interactúa con recursos de otro. No es un firewall general para cualquier petición de red ni una comprobación del rol del usuario.

Un enlace o un formulario pueden iniciar determinados accesos a otro origen. Otra cuestión es si el código de la página puede leer su contenido. La [documentación de SOP de MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) distingue esas operaciones en lugar de tratarlas como una prohibición única.

**CORS**, Cross-Origin Resource Sharing, permite que el servidor declare qué orígenes pueden acceder a determinadas respuestas bajo el protocolo del navegador. Es una relajación controlada de ciertas restricciones, no una credencial de usuario.

Si dos clientes pertenecen al mismo origen permitido, el header CORS no distingue sus cuentas ni sus tenants. Esa separación sigue siendo responsabilidad de sesión, permisos y acceso a datos en el backend.

## Una petición simple puede llegar antes de comprobar la lectura

En el [laboratorio descargable](/assets/examples/api-navegador-lab.zip), una página del origen de pruebas hace un POST a la ruta unsafe de la aplicación. Utiliza URLSearchParams y un tipo de contenido de formulario, sin headers personalizados.

El navegador puede enviar esa petición sin un preflight CORS previo. La sesión Lax se adjunta porque este caso es same-site y fetch pide credentials: include. La API cambia el título y devuelve JSON sin habilitar lectura cross-origin.

Fetch rechaza el acceso a la respuesta. El test navega después a la aplicación y consulta el título desde allí: encuentra «Sin lectura CORS». El efecto existe aunque el otro script no haya podido inspeccionar el JSON.

Una respuesta opaca con mode: no-cors tampoco convertiría la operación en un acceso autorizado ni habilitaría lectura del cuerpo. Cambiar una opción de fetch para silenciar la consola no sustituye el diseño de la API.

El servidor corregido del artículo anterior exige token CSRF y Origin antes de escribir. Esa es la diferencia relevante para el efecto, no añadir o quitar un header de respuesta CORS después de la mutación.

## El preflight pregunta antes de ciertas peticiones

Si pedimos PATCH y enviamos Content-Type application/json junto con X-Lab, el navegador necesita una comprobación previa. Envía **OPTIONS** con el origen, el método solicitado y los nombres de headers que quiere utilizar.

Nuestro servidor acepta únicamente el origen trusted, PATCH y los headers content-type y x-lab. Una respuesta positiva incluye Access-Control-Allow-Origin con el origen exacto, Access-Control-Allow-Methods y Access-Control-Allow-Headers.

El test intenta primero desde el origen no permitido. El contador del servidor registra OPTIONS, pero ninguna petición PATCH. Después lo intenta desde trusted: aparece otro OPTIONS y un PATCH. Son observaciones del servidor, no deducciones a partir de que fetch muestre un error.

La ruta PATCH no modifica datos. Solo responde si tiene una sesión de fixture y permite estudiar el protocolo. **Aceptar el preflight no concede autorización de negocio**: la petición real debe seguir autenticándose y pasando sus controles.

<img src="/assets/visuals/api-contracts/API-BROWSER-CORS.svg" alt="Un POST simple puede llegar y cambiar estado aunque CORS bloquee la lectura posterior. Un PATCH con headers no simples provoca OPTIONS; si el preflight se deniega no se envía PATCH, y si se permite la API todavía debe autenticar la petición real." width="293" height="815" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-BROWSER-CORS.svg).

El preflight no lleva la cookie de sesión como requisito de este contrato. Exigir el login de usuario antes de responder cualquier OPTIONS puede impedir que un navegador legítimo llegue a enviar la petición real. Eso no justifica responder con permisos amplios: se valida la solicitud del protocolo con la allowlist elegida.

Los detalles de qué métodos y headers requieren esta comprobación están en la [guía de CORS de MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS). No conviene memorizar «POST pasa, PATCH no» sin mirar también headers, contenido y modo de la petición.

## Credentials include necesita una respuesta compatible

Fetch utiliza por defecto credentials: same-origin. En nuestra prueba cross-origin elegimos **include** expresamente. Esa opción no obliga al navegador a enviar una cookie si sus demás políticas la excluyen.

Para habilitar lectura con credenciales, la variante allow devuelve el origen exacto permitido y Access-Control-Allow-Credentials: true. La variante wildcard combina deliberadamente `Access-Control-Allow-Origin: *` con credenciales; Chromium no permite leer esa respuesta bajo el modo usado.

No arreglamos el caso reflejando cualquier Origin recibido. Una allowlist que acepta todos los valores porque «necesitamos cookies» deja de expresar una frontera útil. El origen permitido se configura en el servidor y se compara completo.

La respuesta añade **Vary: Origin** porque su representación de permisos depende de ese header. También usa no-store en esta demo. En una API con caché compartida, hay que diseñar correctamente la variación de headers y datos privados; este ejemplo no verifica un CDN.

## La autorización debe sobrevivir a un cliente que no aplique CORS

Otro test utiliza fetch de Node con una cookie de fixture válida. Solicita la ruta con CORS cerrado y obtiene 200 con el título. Ese cliente no aplica la política de acceso de un documento del navegador.

No hemos saltado un control de identidad: la petición incluye la sesión correcta. Hemos demostrado que la ausencia de Access-Control-Allow-Origin no era un control de autorización del servidor.

El control complementario hace una petición al endpoint allow sin cookie y recibe 401. Estar en el origen permitido tampoco inicia una sesión. Ambas pruebas son necesarias para evitar conclusiones distintas pero igualmente equivocadas.

Un atacante puede inventar Origin desde una herramienta HTTP, pero no por eso conoce una sesión válida o recibe permiso sobre todos los recursos. Los controles de procedencia para navegador y los de identidad atienden amenazas distintas.

## La prueba debe observar el navegador sin sustituir su protocolo

Un test que simule OPTIONS manualmente puede verificar el handler, pero no demuestra que el navegador lo envíe ni que retenga la petición posterior al denegarse.

Por eso combinamos siete pruebas HTTP con ocho de Chromium. En estas últimas no interceptamos ni resolvemos las peticiones mediante routing de Playwright. Observamos los destinos solicitados y exigimos que pertenezcan a los servidores locales del test; los contadores distinguen OPTIONS de PATCH.

Cada caso arranca servidores propios, crea una sesión nueva y los cierra al acabar. Así una respuesta de preflight cacheada o una cookie de un test previo no explica por accidente el resultado del siguiente.

La especificación de [Fetch define el protocolo CORS](https://fetch.spec.whatwg.org/#http-cors-protocol). El laboratorio ilustra una selección de sus comportamientos; no implementa un navegador ni comprueba todas sus variantes.

## Garantías y límites

Desde el ZIP, ejecuta `pnpm install --frozen-lockfile`, instala Chromium con `pnpm exec playwright install chromium --only-shell` y lanza `pnpm test`. El servidor manual se inicia con `pnpm serve`.

La evidencia cubre lectura permitida y denegada, wildcard con credenciales, POST con efectos sin lectura, preflight positivo y negativo, y acceso autenticado desde Node. No mide rendimiento ni demuestra políticas de cookies de terceros, navegadores distintos o Private Network Access.

Todo es HTTP de loopback, con credenciales y títulos ficticios. Los puertos separan orígenes, no cookies; los tres servicios están bajo control de la prueba. No lo despliegues ni lo presentes como configuración de sesión de producción.

## Ejercicio: no confundir un error de lectura con una denegación de negocio

Añade otro origen local que no esté en la allowlist. Exige que no pueda leer el JSON de allow. Después usa un cliente Node sin cookie y comprueba que recibe 401, aunque envíe el texto exacto del origen trusted.

Por último, escribe qué controla cada paso: selección de origen para lectura, autenticación de la petición real, protección CSRF y permiso sobre el recurso. Si una respuesta depende solo de «CORS está configurado», falta una parte del contrato.

Para seguir el recorrido de los datos dentro del backend, continúa con el
[threat model de una API multi-tenant](/posts/threat-model-api-multi-tenant-pruebas).

## Referencias

- [MDN: Same-Origin Policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).
- [MDN: guía de CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
- [WHATWG Fetch: protocolo CORS](https://fetch.spec.whatwg.org/#http-cors-protocol).

Fuentes consultadas el 19 de octubre de 2026. Los resultados descritos corresponden a Chromium y al cliente HTTP de Node del laboratorio.
