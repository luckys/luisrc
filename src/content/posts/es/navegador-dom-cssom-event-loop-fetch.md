---
id: P009
title: 'Del HTML a la pantalla: qué hace el navegador mientras tu JavaScript espera'
published: 2026-10-18T02:08:00Z
locale: es
translationKey: computing-browser-runtime
slug: navegador-dom-cssom-event-loop-fetch
draft: true
status: draft
math: true
level: intermedio
prerequisites: [P008]
description: 'DOM, CSSOM, rendering, tareas, microtasks, Fetch y cookies: seguir una navegación real y observar un bloqueo del main thread y una respuesta bloqueada por CORS.'
author: 'Luis Ramírez Calle'
series: 'Computación, sistemas y redes: del proceso al navegador'
tags: [navegador, frontend, event-loop, seguridad]
---

El servidor ha respondido, pero el botón todavía no reacciona. Tener los bytes disponibles no significa que el navegador haya terminado de interpretarlos, ejecutar scripts, calcular posiciones y actualizar la pantalla. Una parte del retraso puede estar después de la red.

Con [HTTP y caché](/posts/http-semantica-versiones-etag-cache) como base, seguiremos el recorrido desde HTML hasta un Fetch con cookie. El laboratorio registra una navegación real y provoca trabajo síncrono acotado para observar qué deja de avanzar en el main thread.

## DOM y CSSOM describen estructuras, no píxeles finales

El parser de HTML construye el **DOM**, una representación estructurada del documento. Las reglas de estilo forman el **CSSOM** y participan en el cálculo de estilos aplicables a los elementos.

El navegador debe determinar estilos, calcular geometría mediante **layout**, producir instrucciones de **paint** y componer el resultado. Algunas actualizaciones pueden reutilizar trabajo previo; cambiar una propiedad no obliga siempre a repetir todas las etapas para toda la página.

Un script puede modificar DOM o estilos y obligar a revisar partes de ese trabajo. Leer geometría después de escribir estilos repetidamente puede forzar sincronizaciones costosas. En cambio, no conviene etiquetar cualquier acceso al DOM como «lento» sin medir su efecto concreto.

HTML y recursos también pueden descubrirse de forma progresiva. La colocación y tipo de script, su carga y ejecución afectan a cuándo puede continuar el parser y a eventos del documento. El fixture utiliza un módulo para que su código encuentre los elementos que necesita.

<img src="/assets/visuals/computing-series/P009.svg" alt="El navegador interpreta HTML y CSS, construye DOM y CSSOM, calcula layout y pintura; tareas JavaScript pueden modificar ese estado y retrasar la siguiente oportunidad de renderizado, mientras Fetch realiza trabajo de red y programa continuaciones." width="1074" height="818" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/computing-series/P009.svg).

## El event loop no interrumpe un cálculo para pintar una respuesta

Una **task** puede ejecutar JavaScript asociado a un evento o timer. Las **microtasks**, incluidas continuaciones de ciertas promesas, se procesan en los checkpoints definidos por el runtime. No son otro hilo para cálculo paralelo.

El navegador obtiene oportunidades de actualizar el renderizado según su modelo de ejecución; una promesa resuelta no garantiza que haya pintado entre dos fragmentos de código. Encadenar microtasks sin dejar avanzar otras fases también puede perjudicar respuesta.

Un `setTimeout(...,0)` solicita que una tarea pueda ejecutarse cuando corresponda, no una interrupción inmediata. Si el código actual sigue calculando, el callback tiene que esperar. `async` cambia cómo se expresa la espera, pero un bucle síncrono dentro de esa función sigue utilizando su hilo.

Archivo: `computing-networks/browser.mjs`, trabajo deliberado del botón de prueba.

```javascript
const start = performance.now()
while (performance.now() - start < 80) {} // Solo para observar un bloqueo deliberado.
mark('busy:end')
```

El handler registra el inicio, programa un timer y termina el cálculo antes de que se registre ese timer. Chromium también observa una **long task** de aproximadamente **81 ms** en la ejecución archivada. Es una observación de ese fixture, no una estimación del coste de un clic normal.

## Navigation Timing y los eventos responden a preguntas diferentes

El [laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/computing-networks/browser.mjs) conserva `results/browser.json`: timings de navegación, eventos instrumentados y long tasks. La traza muestra módulo, microtask, DOMContentLoaded, respuesta Fetch y, tras el clic, inicio/fin del bloqueo y timer.

**DOMContentLoaded** no significa «todo ha terminado de cargar» ni mide cuándo una aplicación está preparada para cualquier interacción. Un Fetch iniciado por el código puede continuar después. Los eventos de navegación y las métricas visuales tampoco son equivalentes.

La prueba comprueba relaciones de orden y la presencia de la tarea larga. No exige que la red local o el ordenador produzcan los mismos milisegundos al repetir. Un perfil real debe relacionar actividad de script, recursos y pintado, no elegir una barra aislada como explicación universal.

<img src="/assets/visuals/computing-series/browser-timeline.svg" alt="Instantes observados de navegación y eventos del fixture; el clic ocurre después de cargar y produce un intervalo de trabajo síncrono antes de que pueda ejecutarse el timer." width="900" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar la traza](/assets/visuals/computing-series/browser-timeline.svg). El hueco anterior al clic pertenece a la ejecución del experimento y no se atribuye al tiempo del servidor.

## Fetch incluye reglas de origen y credenciales además de la red

Un **origin** combina esquema, host y puerto. Cambiar el puerto crea otro origen aunque ambas aplicaciones estén en el mismo ordenador. La **Same-Origin Policy** limita qué puede leer y manipular un documento respecto a otros orígenes.

**Fetch** aplica reglas de credenciales y **CORS**. No basta con que un servidor acepte una conexión para que el script pueda leer su respuesta. Y un rechazo de lectura por CORS no demuestra que la petición nunca saliera.

El fixture crea dos servidores en puertos distintos de `127.0.0.1`. Desde el primero se realiza un GET al segundo con credenciales incluidas. El segundo recibe la cookie ficticia, pero no devuelve las cabeceras CORS necesarias: el navegador rechaza la lectura desde el script.

Ese caso no utiliza un preflight porque la petición concreta cumple las condiciones de una solicitud sencilla. Otras combinaciones de método y cabeceras pueden exigirlo. No podemos generalizar que toda petición cross-origin se envía igual o que CORS sea autorización de negocio.

## Cookies, HttpOnly y storage no tienen las mismas propiedades

La cookie de prueba utiliza **HttpOnly**: JavaScript no puede leerla mediante `document.cookie`, pero el navegador puede enviarla en una petición permitida. La prueba confirma ambos hechos. No es un secreto real: su contenido es literalmente `fake`.

**SameSite** regula el contexto de envío según reglas de site, un concepto distinto de origin. Dos puertos del mismo host pueden ser cross-origin y seguir siendo same-site. **Secure** restringe el envío a conexiones seguras bajo sus reglas; nuestro fixture HTTP loopback no es un patrón de autenticación para producción.

**localStorage** es accesible para scripts del origen. Guardar allí un token no lo protege de código malicioso que se ejecute con ese acceso. HttpOnly limita lectura de cookie, pero tampoco impide que un script comprometido intente acciones autenticadas desde la página.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p009/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/computing-networks
```

## Garantías y límites

Se observa navegación en Chromium, cookie ficticia, CORS y bloqueo del main thread. No implementamos autenticación real, no demostramos ausencia de XSS ni auditamos todos los motores. El servidor del fixture no debe desplegarse como servicio de sesiones.

## Ejercicio: una promesa no es una oportunidad garantizada de pintado

Compara el botón actual con trabajo repartido entre tareas y registra cuándo puede actualizarse un indicador. Después prueba microtasks encadenadas. El criterio es describir qué ejecutó el hilo y qué oportunidad de renderizado existió, no asumir que cualquier `await` libera la interfaz.

Para profundizar en la interfaz, puedes continuar con [frontend accesible](/posts/frontend-accesible-semantica-teclado-foco) y [medición de rendimiento frontend](/posts/rendimiento-frontend-medir-antes-optimizar). La siguiente serie del roadmap recuperará los fundamentos del código.

## Referencias

- [HTML Standard: event loops, tareas y renderizado](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops).
- [Fetch Standard: credenciales y CORS](https://fetch.spec.whatwg.org/).
- [W3C: Navigation Timing](https://www.w3.org/TR/navigation-timing-2/).
- [W3C: Long Tasks API](https://www.w3.org/TR/longtasks-1/).
