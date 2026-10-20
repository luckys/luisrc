---
id: P029
title: 'XSS en el DOM: mostrar texto sin convertirlo en código'
published: 2026-10-18T04:19:00Z
locale: es
translationKey: xss-dom-texto-html-contextos
slug: xss-dom-texto-html-contextos
draft: true
status: draft
level: intermedio
prerequisites: [P009, P026]
description: 'Reproduce un DOM XSS local y corrige el sink con textContent. Distingue texto, HTML, URLs y el alcance real de HttpOnly y del storage.'
author: 'Luis Ramírez Calle'
series: 'Diseño de APIs y seguridad web: contratos, identidad y permisos'
tags: [seguridad, navegador, xss, frontend, testing]
---

El comentario debía aparecer como texto. Al asignarlo a innerHTML, el navegador lo interpretó como una imagen con un manejador de errores. Una cadena que venía de fuera terminó ejecutándose dentro de la aplicación.

Ese cambio de significado es el problema que vamos a observar. No hace falta robar una cookie ni encontrar un servidor remoto: una página local y un marcador visible bastan para comprobar que hemos cruzado la frontera entre datos y código.

Después de [probar permisos por objeto](/posts/autorizacion-tests-adversariales-bola), cambiamos de frontera. El backend puede autorizar correctamente una petición y, aun así, el frontend ejecutar contenido que nunca debía haber tratado como instrucciones.

## Qué significa XSS y dónde entra el DOM

**XSS**, Cross-Site Scripting, permite que contenido no confiable se ejecute bajo la confianza de una página. En un **DOM XSS**, el código del cliente lleva un valor hasta una operación que lo interpreta peligrosamente.

Llamaremos **source** al origen del dato y **sink** a la operación donde se utiliza. En nuestra demo, la source es un parámetro q de la URL; el sink vulnerable es innerHTML. La pregunta útil no es solo de dónde viene la cadena, sino qué va a hacer el navegador cuando la reciba.

También se habla de XSS reflected cuando una respuesta incorpora una entrada de la petición, y stored cuando el contenido queda guardado y se muestra después. Estas etiquetas describen aspectos del recorrido, no defensas intercambiables. Guardar una cadena en una base de datos no la convierte en confiable para representarla como HTML.

El ejemplo se centra en una sola decisión: mostrar comentarios de texto. No implementa un editor HTML ni pretende demostrar todas las variantes de XSS.

## Un marcador local demuestra ejecución sin exfiltrar datos

Descarga el [laboratorio del navegador](/assets/examples/api-navegador-lab.zip). Con Node 24.19.0 o posterior, desde la carpeta extraída:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium --only-shell
pnpm serve
```

El terminal muestra tres servidores en puertos efímeros de loopback. No los expongas mediante un túnel ni cambies el bind a una interfaz pública. Hay rutas **intencionadamente vulnerables** y un inicio de sesión de fixture que cualquiera puede abrir.

En la URL que termina en `/xss?mode=unsafe`, añade como q, codificado como parámetro, esta entrada:

```html
<img src="/missing" onerror="document.body.dataset.executed='yes'" />
```

La imagen no existe. Al fallar su carga, el manejador cambia un atributo del body. No lee datos personales, no envía secretos y no contacta con un dominio externo. El test espera ese atributo para demostrar que hubo ejecución.

No utilizamos un bloque script como única sonda. La inserción de HTML mediante innerHTML tiene comportamientos específicos; que un script insertado de cierta forma no se ejecute no demuestra que todos los manejadores u otros mecanismos sean inocuos.

## Si necesitas texto, elige una operación que cree texto

Este fragmento es el código real de `render.mjs`. Las variantes inseguras existen únicamente para comparar comportamientos en el sandbox:

```javascript
if (params.get('mode') === 'safe') {
  output.textContent = value
} else {
  // Intencionadamente vulnerable. Solo existe en este sandbox local.
  output.innerHTML = value
}
document.body.dataset.ready = 'yes'
```

Con safe, el contenido aparece literalmente dentro de un div. No se crea una imagen y no hay un evento onerror que ejecutar. **textContent** no intenta adivinar si la cadena parece maliciosa: en ese elemento la trata como texto.

Esto importa porque una solución basada en quitar la palabra script seguiría dejando sin resolver la elección del intérprete. El contrato del comentario no pedía HTML; no hay una razón funcional para activar su parser.

No precodificamos el valor antes de pasarlo a textContent. Si convertimos previamente el signo menor en una entidad, podemos acabar mostrando la entidad como texto y deformando el comentario. La [documentación de textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent) explica la diferencia con innerHTML.

La recomendación se refiere a elementos ordinarios de texto, como este div. Poner texto en un elemento script no transforma código arbitrario en un comentario seguro.

<img src="/assets/visuals/api-contracts/P029.svg" alt="Un parámetro no confiable llega a dos sinks diferentes. innerHTML crea una imagen y permite ejecutar su handler en la variante vulnerable; textContent crea texto literal y no crea ese elemento." width="253" height="815" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/api-contracts/P029.svg).

## Texto, atributos y URLs necesitan contratos distintos

Un enlace no es simplemente otro lugar donde pegar una cadena. Si permites que un usuario proponga una URL, decide primero qué protocolos y destinos admite el producto. Después asígnala con la API adecuada. Escapar comillas no convierte automáticamente un destino no permitido en uno aceptable.

Tampoco conviene interpolar datos en manejadores como onclick o construir código con eval. Podemos registrar una función conocida con addEventListener y pasarle los datos como valores. Así no pedimos al navegador que vuelva a interpretar una cadena como programa.

En una plantilla de servidor, el escape debe corresponder al contexto de salida. En un componente, conserva el mecanismo de representación de texto del framework y revisa sus salidas de escape, como v-html o dangerouslySetInnerHTML. Un tipo TypeScript string no indica si el valor contiene texto, HTML o una URL admitida.

Si realmente necesitas **rich text**, el requisito cambia: hay que conservar un subconjunto de HTML. Hace falta un sanitizador mantenido y una política concreta de elementos y atributos, no una expresión regular casera. Ese flujo necesita sus propias pruebas; nuestro laboratorio no lo implementa. [OWASP detalla las defensas por contexto y la sanitización de HTML](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

## HttpOnly protege la lectura de la cookie, no toda la sesión

La sesión ficticia del laboratorio utiliza una cookie **HttpOnly**. En Chromium, document.cookie no muestra esa cookie. Sin embargo, el test XSS puede hacer fetch a una ruta de la propia aplicación y el navegador adjunta la sesión.

El resultado observado es concreto: el marcador no ve la cookie, pero consigue cambiar un título ficticio mediante la ruta vulnerable. No necesitamos extraer el identificador para demostrar una acción bajo esa sesión.

El test también guarda «dato ficticio» en **localStorage** antes de ejecutar la sonda. El script inyectado puede leerlo porque se ejecuta en el mismo origen. sessionStorage cambia la duración y el ámbito de almacenamiento, pero no constituye una barrera contra un script que ya ejecuta en ese contexto.

Por eso no trasladamos un secreto desde una cookie HttpOnly al storage para «arreglar» XSS. Son decisiones de almacenamiento distintas, con riesgos diferentes. Reducir datos sensibles accesibles al cliente ayuda a limitar consecuencias, pero no elimina el sink vulnerable.

## Los scripts de terceros también son código dentro de la página

Una biblioteca de analítica cargada mediante script no queda confinada porque su archivo venga de otro dominio. Ejecuta con capacidades de la página que la integra, sujetas a los controles aplicables.

Antes de añadirla, pregunta qué datos necesita, qué versiones se actualizan y qué ocurre si su distribución se compromete. Un iframe correctamente aislado ofrece otra frontera, con comunicación y permisos explícitos; no equivale a insertar directamente el mismo script.

Esta parte es una revisión de diseño, no una explotación de un proveedor. La guía de [gestión de JavaScript de terceros de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html) ayuda a inventariar dependencias y sus privilegios. No hemos auditado bibliotecas externas en este ejercicio.

## Garantías y límites

Ejecuta `pnpm test`. La prueba de Chromium compara ejecución vulnerable, texto literal y ausencia de nodos img en la variante corregida. Otra comprueba HttpOnly, storage y una petición autenticada desde el XSS.

Las peticiones del navegador de pruebas se limitan a los servidores locales de ese test. No hay usuarios reales ni un servicio publicado. La corrección demuestra el comportamiento de este div, no la ausencia de XSS en cualquier plantilla o dependencia de una aplicación completa.

La sesión usa HTTP de loopback y omite Secure deliberadamente. En producción necesita HTTPS y una configuración apropiada. Los puertos separan orígenes, pero **no aíslan cookies por puerto**: los servidores de fixture están bajo nuestro control y no registran esas cabeceras. No reproducen una arquitectura de hosts de producción.

## Ejercicio: conservar el requisito sin ampliar el intérprete

Añade una prueba con comillas, signos menor y ampersand en un comentario. Exige que el texto final coincida exactamente y que no aparezcan elementos descendientes. Después añade un enlace como una capacidad separada, con una política de URLs y pruebas propias.

En el [siguiente artículo sobre CSP](/posts/csp-nonces-report-only-defensa-adicional) mantendremos intencionadamente el sink incorrecto para ver qué bloquea una defensa adicional y qué no repara.

## Referencias

- [MDN: Node.textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent).
- [OWASP: prevención de XSS y contextos de salida](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).
- [OWASP: gestión de JavaScript de terceros](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html).

Fuentes consultadas el 19 de octubre de 2026. Las observaciones de ejecución corresponden al laboratorio local.
