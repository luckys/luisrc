---
id: P068
title: 'CSR, SSR y SSG: qué recibe el navegador antes de ejecutar tu código'
published: 2026-10-17T05:01:00Z
locale: es
translationKey: frontend-rendering-strategies
slug: csr-ssr-ssg-hydration-renderizado
draft: true
status: draft
level: intermedio
prerequisites: [P067]
description: 'Compara CSR, SSR, SSG e hydration sin confundir contenido visible con una aplicación lista para responder.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, react, ssr, rendimiento]
---

Una página muestra el nombre del pedido antes de descargar el código de React, pero todavía no responde a Guardar. Otra permanece vacía hasta ejecutar ese código. Ambas pueden acabar mostrando el mismo componente; el recorrido hasta llegar a él es distinto.

Después de [construir un formulario accesible](/posts/frontend-accesible-semantica-teclado-foco), toca separar dos preguntas: cuándo aparece su contenido y cuándo empieza a funcionar su comportamiento.

## CSR, SSR y SSG describen dónde y cuándo se produce HTML

En **client-side rendering**, o **CSR**, el navegador ejecuta código para crear el contenido principal. El servidor puede entregar un documento mínimo y el bundle de la aplicación. Después quizá haya que pedir datos. Esa secuencia importa si encadena esperas que podrían haberse evitado.

Con **server-side rendering**, o **SSR**, el servidor genera HTML para la petición. Puede incluir datos antes de entregar el documento. En el laboratorio usamos [`renderToString`](https://react.dev/reference/react-dom/server) para hacerlo visible sin añadir un framework de routing. No es una recomendación de construir un framework propio.

**Static site generation**, o **SSG**, produce páginas por adelantado, por ejemplo durante un build. Facilita servir contenido reutilizable desde caché, pero necesitas decidir cómo actualizarlo. Una guía técnica cambia de otra manera que el saldo privado de una cuenta. La [documentación de Astro](https://docs.astro.build/en/guides/on-demand-rendering/) compara el prerender con el render por petición.

Estas estrategias se pueden combinar por ruta o por sección. «La aplicación usa SSR» no explica por sí solo de dónde llegan todos sus datos, qué queda cacheado ni cuánto código descarga el cliente.

<img src="/assets/visuals/frontend-series/P068.svg" alt="SSR entrega HTML que después se hidrata con los mismos datos; CSR entrega un contenedor vacío y crea el contenido después de ejecutar JavaScript." width="959" height="604" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P068.svg).

## Hydration conecta comportamiento con HTML existente

React utiliza **hydrateRoot** cuando el contenido ya fue renderizado en el servidor. El primer render del cliente debe corresponderse con ese HTML. Su [documentación de hydration](https://react.dev/reference/react-dom/client/hydrateRoot) advierte de los problemas de producir resultados diferentes.

Por eso enviamos el mismo `seed`, el pedido inicial, al render del servidor y al del cliente. Si uno muestra «Pedido original» y el otro lee inmediatamente otro valor de `localStorage`, hemos creado una discrepancia.

Archivo: `frontend-tiempo-real/src/client.tsx`, selección del punto de entrada.

```tsx
const app = <App view={data.view} seed={data.seed} />
if (data.mode === 'ssr') hydrateRoot(root, app)
else createRoot(root).render(app)
```

Los imports, la lectura del elemento `root` y los datos de arranque están en el archivo completo. La diferencia relevante no es una opción estética: elegimos hidratar un árbol existente o crear uno donde no lo hay.

## Una comparación que se puede observar sin cronómetro

Desde el [laboratorio descargable](/assets/examples/frontend-tiempo-real-lab.zip), ejecuta:

```bash
pnpm install --frozen-lockfile
pnpm start
```

Abre `http://127.0.0.1:4399/?mode=ssr` y la variante `?mode=csr`. Con JavaScript desactivado, la primera contiene el formulario; la segunda tiene el contenedor vacío. La prueba `SSR contiene datos` comprueba precisamente esa diferencia. Otra prueba verifica que las dos variantes son editables con JavaScript y que no aparecen errores de hydration.

No deducimos de esto que SSR sea siempre más rápido. No hemos comparado TTFB, caché, red móvil ni coste del servidor. Hemos comprobado una propiedad anterior: qué contenido existe antes del código del cliente.

## Routing, bundling y carga incremental cambian la secuencia

El laboratorio utiliza enlaces con navegación de documento completo. Un router de cliente puede actualizar la vista sin descargar todo el documento, pero sigue necesitando resolver datos, errores, historial y foco. No convierte automáticamente cada navegación en una operación barata.

El **bundling** agrupa y transforma módulos para distribuirlos. Si enviamos todo el editor colaborativo y el código de audio a quien solo quiere ver un formulario, aumentamos trabajo inicial innecesario.

**Code splitting** permite separar partes y cargarlas cuando se necesitan. React ofrece [`lazy`](https://react.dev/reference/react/lazy) para cargar componentes de forma diferida con un límite de carga. No lo aplicamos al bundle didáctico: mantener un único punto de entrada facilita seguir el ejemplo, pero no representa el reparto que elegiría para una aplicación grande.

La carga incremental evita esperar a todo para mostrar algo útil. También necesita estados de error y navegación coherentes. No basta con sustituir la pantalla vacía por varios spinners que nunca explican qué falta.

## Elegir según la página, no por reputación

Para contenido público relativamente estable, empezaría evaluando generación estática. Para una pantalla privada que necesita datos por petición, SSR puede adelantar contenido, pero obliga a tratar correctamente identidad y cachés. Para una herramienta muy interactiva ya cargada, CSR puede ser una opción razonable.

SSR no elimina las actualizaciones de componentes en el cliente. Tampoco hace funcionar este formulario sin JavaScript: aquí el envío depende de un handler. Una solución de **progressive enhancement** requeriría una ruta de envío de formulario real; esa alternativa no está implementada.

## Garantías y límites

Se prueban HTML inicial e interacción posterior en ambas variantes. No se ejecuta un build SSG, un router cliente ni streaming SSR. La demo tampoco administra caché compartida o sesiones; no debe exponerse a Internet.

## Ejercicio: romper y reparar hydration

En una copia, renderiza un nombre fijo en el servidor y otro en el cliente. Captura el error; después restaura un único snapshot de arranque. El criterio no es ocultar el aviso con `suppressHydrationWarning`, sino hacer coincidir la primera vista.

Una vez renderizada la pantalla, aparece otro problema: [mantener sus datos coherentes cuando las peticiones terminan en otro orden](/posts/estado-cliente-servidor-optimismo-races).

## Referencias

- [React: APIs de servidor](https://react.dev/reference/react-dom/server).
- [React: hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot).
- [React: lazy](https://react.dev/reference/react/lazy).
- [Astro: prerender y render bajo demanda](https://docs.astro.build/en/guides/on-demand-rendering/).

Fuentes consultadas el 17 de octubre de 2026. No se presenta esta comparación funcional como un benchmark.
