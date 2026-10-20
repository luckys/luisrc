---
id: API-BROWSER-CSP
title: 'CSP con nonces: bloquear ejecución no es corregir el HTML inyectado'
published: 2026-10-18T04:20:00Z
locale: es
translationKey: csp-nonces-report-only-defensa-adicional
slug: csp-nonces-report-only-defensa-adicional
draft: true
status: draft
level: intermedio
prerequisites: [P029]
description: 'Compara CSP enforce y Report-Only en Chromium. Genera nonces por respuesta y comprueba los límites de una política sin confundirla con sanitización.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, navegador, csp, xss, testing]
---

La imagen inyectada sigue en el DOM, pero su manejador no se ejecuta. La página no se ha vuelto correcta: una política del navegador ha impedido una consecuencia concreta del fallo.

Esa diferencia permite entender **CSP**, Content Security Policy, sin tratarla como un limpiador de HTML. Vamos a usar el mismo ejemplo de [DOM XSS](/posts/xss-dom-texto-html-contextos), añadir una política y observar qué cambia cuando se aplica o solamente se evalúa en modo de informe.

No mezclaremos aquí cookies ni peticiones inducidas desde otro sitio. Esa frontera tendrá [su propio artículo de CSRF](/posts/csrf-cookies-samesite-origin-token).

## Qué decide una Content Security Policy

Una **CSP** comunica al navegador restricciones para el documento: qué recursos puede cargar o ejecutar y otras condiciones de su comportamiento. No modifica la cadena recibida ni convierte un nodo peligroso en texto.

Nuestra política llega mediante un header HTTP. Es una decisión del servidor al generar la respuesta HTML; no procede del parámetro q. La aplicación tampoco deja que ese parámetro elija directivas o añada fuentes permitidas.

En el laboratorio queremos permitir un único módulo propio, bloquear manejadores inline y no abrir conexiones adicionales desde ese documento. La [guía de CSP de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) distingue esta capa adicional de las correcciones que deben hacerse donde se representa la entrada.

Si la página necesita imágenes, estilos o conexiones legítimas, la política tendrá que expresar esas necesidades. Copiar una configuración muy restrictiva sin probar la funcionalidad puede producir una página aparentemente protegida porque ya no funciona.

## Un nonce autoriza el script elegido por el servidor

Un **nonce** es un valor impredecible que generamos para cada respuesta. Incluimos el mismo valor en script-src y en el atributo nonce del script que hemos seleccionado. No es una contraseña del usuario ni un token de sesión.

Esta es la función real de `lab.mjs`:

```javascript
export function contentPolicy(nonce) {
  return `default-src 'none'; script-src 'nonce-${nonce}'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
}
```

Cada respuesta de la ruta genera 18 bytes aleatorios y los representa en base64. El módulo render.mjs lleva ese nonce. La entrada del usuario solo se procesa después, desde el módulo, y no recibe automáticamente autorización para introducir otros scripts.

Generar un nonce nuevo pero reutilizar un HTML cacheado con el anterior puede romper la página. Reutilizar el mismo nonce en todas las respuestas elimina una propiedad que estábamos buscando. Hay que pensar la generación del header y del documento como una sola operación de representación, incluidos los cachés intermedios.

Nuestro servidor utiliza no-store y no implementa un CDN. Los tests comprueban que dos respuestas consecutivas llevan políticas con nonces diferentes. No demuestran que una configuración de caché ajena mantenga esa correspondencia.

## Leer las directivas evita atribuirles garantías que no tienen

**default-src 'none'** establece un punto de partida restrictivo para las directivas de carga que heredan de ella. No significa que cualquier directiva posible quede configurada por ese valor.

**script-src** permite el módulo con el nonce correspondiente. No añadimos unsafe-inline para resolver errores de compatibilidad: eso cambiaría precisamente la restricción que queremos estudiar. Los manejadores de eventos inline del marcador no tienen autorización por llevar una imagen en el mismo origen.

**img-src 'self'** permite pedir la imagen local que falla. Así la ausencia de ejecución no se explica por haber impedido toda carga de imágenes. Nos interesa observar el rechazo del handler, no ocultarlo detrás de otro bloqueo accidental.

**base-uri 'none'** impide que un elemento base inyectado cambie cómo se resuelven rutas relativas. **form-action 'self'** limita destinos de formularios del documento y **frame-ancestors 'none'** impide que se incruste en un frame. Estas dos decisiones no equivalen a comprobar permisos en el servidor.

La página de prueba no necesita fetch en la variante CSP. Al no abrir connect-src, sus conexiones de ese tipo quedan sujetas al valor restrictivo heredado. La prueba de XSS que modifica estado pertenece a la variante sin CSP, no a una afirmación de que ese fetch atravesó esta política.

## Enforce y Report-Only producen resultados diferentes

Visita `/xss?mode=enforce` en el [laboratorio descargable](/assets/examples/api-navegador-lab.zip), con el mismo parámetro q del artículo anterior. El navegador crea la imagen porque el sink sigue siendo innerHTML, pero bloquea la ejecución del atributo onerror.

Con `/xss?mode=report`, el servidor envía **Content-Security-Policy-Report-Only** en lugar de Content-Security-Policy. La política se evalúa sin imponer esos bloqueos. El marcador vuelve a ejecutarse.

El test registra eventos **securitypolicyviolation** y comprueba la disposición enforce o report. No basta con buscar el header desde una terminal: necesitamos comprobar qué hace un navegador al interpretar el documento y el recurso permitido.

<img src="/assets/visuals/api-contracts/API-BROWSER-CSP.svg" alt="El servidor emite HTML y nonce correspondiente. En enforce se permite el módulo elegido y se bloquea el handler inline; en Report-Only se observa la infracción pero el handler se ejecuta. En ambos casos permanece la inyección HTML." width="289" height="906" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/API-BROWSER-CSP.svg).

No configuramos un colector remoto de informes. El evento recogido por el test es evidencia local; no hemos montado una canalización de Reporting API ni afirmamos que el servidor reciba informes. [MDN documenta el alcance de Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only).

## El HTML inyectado sigue pudiendo afectar a la interfaz

El test enforce exige dos cosas: que el marcador no se ejecute y que siga existiendo un img dentro del contenedor. Esa segunda expectativa nos obliga a no confundir el bloqueo con una corrección del sink.

Aunque una política impida ejecutar JavaScript, insertar elementos no previstos puede alterar lo que el lector ve. No queremos que un comentario se convierta en controles o contenido que parezca emitido por la aplicación.

La corrección funcional sigue siendo representar el comentario como texto. CSP se conserva como otra capa por si aparece un recorrido diferente. Esta combinación tiene un coste de mantenimiento, pero permite comprobar dos propiedades distintas en lugar de apostar todo a una sola configuración.

## Permitir un dominio no hace seguro todo su contenido

Una allowlist amplia de hosts puede terminar confiando en servicios con contenido subido por usuarios, endpoints dinámicos o dependencias que cambian sin una revisión propia. «Está en un CDN conocido» no explica qué archivo aceptamos ejecutar ni quién controla sus actualizaciones.

En esta demo elegimos un nonce para un script concreto. En un sitio estático pueden encajar hashes de scripts de contenido estable. Si utilizas **Subresource Integrity**, su comprobación del contenido descargado atiende una pregunta diferente de la política de carga; hay que mantener hashes, versiones y condiciones de la descarga.

No hemos implementado SRI, Trusted Types ni una política strict-dynamic. Son decisiones adicionales, no propiedades implícitas del ejemplo. La [documentación de script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) permite contrastar qué autoriza cada expresión antes de introducirla.

## Garantías y límites

Desde el ZIP, instala con pnpm, instala Chromium mediante Playwright y ejecuta `pnpm test`. Hay pruebas HTTP de los headers y nonces, y una prueba de navegador que contrasta el mismo marcador bajo enforce y report.

El módulo legítimo sigue funcionando: marca la página como preparada. Evitamos interpretar «el marcador no ocurrió» como un éxito si en realidad bloqueamos todos los scripts y no llegamos a procesar la entrada.

Solo se prueba Chromium y este documento local. No hemos migrado la CSP del blog, integrado un gestor de etiquetas ni verificado compatibilidad con todos los navegadores. Las rutas de comparación conservan vulnerabilidades educativas y no deben desplegarse.

## Ejercicio: comprobar también la funcionalidad permitida

Añade una prueba que elimine temporalmente el nonce del script seleccionado. Comprueba que deja de aparecer la señal ready. Restaura la coincidencia y vuelve a exigir ready, presencia del HTML inyectado y ausencia de ejecución inline.

Después corrige el sink con textContent y conserva la política. Esa última variante debe mostrar el texto completo sin nodos img, además de mantener operativo el módulo autorizado.

## Referencias

- [OWASP: Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).
- [MDN: script-src, nonces y ejecución inline](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).
- [MDN: Content-Security-Policy-Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only).

Fuentes consultadas el 19 de octubre de 2026. El modo de informe se observa mediante eventos del navegador, no mediante un colector remoto.
