---
id: P067
title: 'Frontend accesible: un formulario que se puede usar sin ratón'
published: 2026-10-17T05:00:00Z
locale: es
translationKey: frontend-accessible-keyboard
slug: frontend-accesible-semantica-teclado-foco
draft: true
status: draft
level: intermedio
prerequisites: []
description: 'Semántica HTML, etiquetas, navegación por teclado y foco: una base accesible para formularios y paneles en React.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, accesibilidad, react, typescript]
---

Un formulario permite cambiar el nombre de un pedido, pero el botón Guardar solo responde al ratón. Para quien navega con teclado, esa funcionalidad no existe aunque la petición HTTP esté perfectamente implementada.

La accesibilidad empieza en estas decisiones pequeñas. Vamos a construir la base de un panel con **React** y **TypeScript**, sin convertir una etiqueta HTML en un componente sofisticado cuando no hace falta.

## El HTML también es una API

Una interfaz no comunica únicamente mediante píxeles. Su estructura expone nombres, roles y relaciones que utilizan el navegador y las tecnologías de asistencia.

Un **button** expresa una acción. Un enlace con `href` expresa navegación. Un **label** identifica un campo. Si elegimos un `div` para todo, acabamos teniendo que reconstruir comportamiento que los elementos nativos ya ofrecen.

La [guía de formularios de WAI](https://www.w3.org/WAI/tutorials/forms/labels/) explica cómo asociar etiquetas y controles. Un placeholder no sustituye a una etiqueta: desaparece al escribir y puede no comunicar suficientemente el propósito del campo.

En esta serie damos por conocida la sintaxis básica de HTML y TypeScript. Aquí aprenderás a recorrer una tarea sin ratón, distinguir nombre accesible de decoración y comprobar qué sucede con el foco cuando cambia la pantalla.

<img src="/assets/visuals/frontend-series/P067.svg" alt="El teclado recorre controles nativos con nombre; guardar cambia el estado de la operación y un mensaje informa del resultado sin mover continuamente el foco." width="623" height="788" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P067.svg).

## Primero un formulario, después los estilos

La versión ingenua es un texto con `onClick` y un input sin etiqueta. Puede parecer un formulario, pero el usuario no dispone de las mismas pistas ni de los mismos controles.

En el laboratorio, `OrderEditor` usa `form`, un input con `id="name"`, su etiqueta y un botón de tipo `submit`. La relación explícita aparece en este fragmento.

Archivo: `realtime-frontend/src/App.tsx`, extracto de `OrderEditor`.

```tsx
<label htmlFor="name">Nombre del pedido</label>
```

En JSX se escribe **htmlFor**; el HTML resultante utiliza `for`. El `onSubmit` del formulario reúne la lógica de guardado. Así no duplicamos el caso «hacer click» y el caso «enviar desde el teclado» en handlers independientes.

El campo tiene `required` y un límite de longitud. Son ayudas de interacción, no una frontera de seguridad: el servidor sigue validando. Ocultar o desactivar un botón tampoco concede ni revoca permisos de backend.

## El foco debe decir dónde estás

Al pulsar **Tab**, el navegador recorre los controles según el orden del documento. Conviene que ese orden coincida con el visual. Añadir valores positivos de `tabIndex` para arreglar un layout suele crear un segundo orden difícil de mantener.

El enlace «Saltar al contenido» evita recorrer toda la navegación en cada visita. Su destino es el contenido principal. Al cargar otra página de la tabla, llevamos el foco a su título: el cambio tiene contexto, no deja al usuario buscando qué ocurrió.

Un anillo de foco visible permite reconocer el control activo. No lo elimines porque el diseño parezca más limpio.

Archivo: `realtime-frontend/src/styles.css`, regla utilizada por el laboratorio.

```css
:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
```

La [referencia WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) permite revisar navegación por teclado, foco visible, contraste y reflow como criterios separados. Cumplir uno no demuestra cumplir el conjunto.

## Comunicar un resultado no exige abrir un modal

Mientras guardamos, el botón muestra un estado pendiente y evita otro envío desde esta interfaz. Un mensaje con **role="status"** informa de la confirmación o del rechazo sin trasladar el foco a cada actualización. WAI describe estas [notificaciones de formularios](https://www.w3.org/WAI/tutorials/forms/notifications/).

Reservaría un diálogo para una decisión que realmente interrumpe el flujo. Añadir ARIA indiscriminadamente no mejora la experiencia: una tabla no necesita convertirse en un `grid` si no vamos a implementar su modelo de teclado.

El CSS usa tamaños relativos, un formulario de ancho limitado y navegación que puede saltar de línea. El objetivo del responsive layout es conservar la tarea, no comprimir todos los controles hasta que quepan.

## Probar la tarea, no solo buscar etiquetas

[Consulta el laboratorio en GitHub](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/realtime-frontend/src/App.tsx). Desde `realtime-frontend/`:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:browser --grep "teclado|responsive"
```

La prueba de teclado usa Tab, Enter y escritura para guardar. La prueba responsive comprueba el ancho a 360 píxeles. Son comprobaciones concretas: no son una auditoría completa ni sustituyen probar con lector de pantalla y usuarios reales.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p067/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/realtime-frontend
```

## Garantías y límites

El ejemplo conserva semántica nativa, nombres de controles y una ruta de teclado probada en Chromium. No demuestra compatibilidad con todos los navegadores, magnificadores o lectores. Tampoco certifica conformidad WCAG.

Para un panel de administración, aplicaría estas reglas antes de añadir filtros, menús y tablas interactivas. Es más sencillo mantener una tarea accesible que reconstruirla después sobre controles sin semántica.

## Ejercicio: detectar una regresión de teclado

Cambia temporalmente Guardar por un `div` con `onClick` en una copia del laboratorio. La tarea debe fallar al recorrerla únicamente con teclado. Restituye el botón y exige que el test vuelva a pasar sin añadir navegación con el ratón.

En el siguiente artículo veremos [qué recibe el navegador antes de que React sea interactivo](/posts/csr-ssr-ssg-hydration-renderizado).

## Referencias

- [WAI: etiquetas de formularios](https://www.w3.org/WAI/tutorials/forms/labels/).
- [WAI: notificaciones y errores](https://www.w3.org/WAI/tutorials/forms/notifications/).
- [WCAG 2.2: referencia de criterios](https://www.w3.org/WAI/WCAG22/quickref/).
- [Playwright: assertions](https://playwright.dev/docs/test-assertions/).

Fuentes consultadas el 17 de octubre de 2026. Laboratorio con React 19.2.0 y Playwright 1.56.1.
