---
id: P072
title: 'Componentes y design systems: contratos pequeños, estados explícitos'
published: 2026-10-17T05:05:00Z
locale: es
translationKey: frontend-component-contracts
slug: componentes-design-system-contratos-estados
draft: true
status: draft
level: intermedio
prerequisites: [P067, P069]
description: 'Composición, tokens semánticos y estados de componentes: compartir decisiones útiles sin crear un framework interno innecesario.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, componentes, react, design-system]
---

Tres pantallas tienen un botón Guardar. En una envía dos veces; en otra no tiene estado pendiente; en la tercera dejó de funcionar al introducirlo dentro de un formulario. Copiar el aspecto no ha conservado el comportamiento.

Un componente compartido resulta útil cuando reúne decisiones que queremos mantener iguales. El punto de partida no es diseñar un catálogo enorme, sino identificar un contrato pequeño que las pantallas realmente necesitan.

## Compartir un contrato, no solo una clase CSS

Después de trabajar [semántica y foco](/posts/frontend-accesible-semantica-teclado-foco) y [estado asíncrono](/posts/estado-cliente-servidor-optimismo-races), podemos extraer `ActionButton`.

Su contrato conserva atributos de un botón nativo y añade `pending`. El tipo por defecto es `button`, evitando envíos accidentales dentro de formularios. El formulario que sí debe enviar declara `type="submit"`.

Archivo: `frontend-tiempo-real/src/components.tsx`, implementación completa del botón.

```tsx
export function ActionButton({
  pending = false,
  disabled,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? 'Guardando…' : children}
    </button>
  )
}
```

`ActionButtonProps` extiende `ButtonHTMLAttributes<HTMLButtonElement>` y añade un booleano opcional. El archivo incluye el import de React. No pasamos una URL, un token de sesión ni el conocimiento de cómo guardar un pedido.

Desactivar el botón evita interacciones repetidas en esta instancia; no garantiza idempotencia en el servidor. Además, un botón desactivado deja de formar parte del recorrido habitual de Tab. Para una acción no disponible por permisos puede ser mejor explicar el motivo junto al control, no confiar en un tooltip inaccesible.

<img src="/assets/visuals/frontend-series/P072.svg" alt="Tokens semánticos alimentan componentes con contratos pequeños; sus variantes se ejercitan aisladas antes de revisar comportamiento y apariencia." width="760" height="832" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P072.svg).

## Composición evita una prop para cada pantalla

La tabla del laboratorio recibe filas. No sabe qué endpoint las produjo ni ejecuta peticiones desde cada celda. La página decide cuándo cargar y qué hacer si falla; la tabla se ocupa de presentar la estructura.

Esto permite probar una colección vacía o textos largos sin arrancar una API diferente para cada caso. También evita que el componente base acumule opciones como `isOrdersScreen`, `useSpecialEndpoint` o `hideErrorForAdmin`.

No toda repetición merece una abstracción. Dos pantallas pueden parecerse hoy y tener reglas que evolucionan por separado. Mantendría una pequeña duplicación antes que una API de componente llena de condiciones que nadie comprende.

## Los tokens expresan la función del valor

Un **design token** con nombre `focus` comunica una intención. `yellow-400` describe un valor de una paleta. Podemos necesitar ambos niveles, pero no son equivalentes.

El CSS del laboratorio utiliza variables para superficie, texto, color de foco y separación. Cambiar `--focus` afecta la señal de navegación compartida. Cambiar una variable no demuestra que las combinaciones mantengan contraste suficiente: hay que revisarlas.

Un **design system** añade documentación, criterios de uso y mantenimiento a los componentes y tokens. Crear una carpeta `ui` no establece por sí solo quién revisa cambios, cómo se deprecian props o qué estados se consideran parte del contrato.

## Los estados vacíos y pendientes también forman parte del diseño

La vista `/?view=components` reúne botón normal, pendiente y desactivado, además de tablas vacía y con texto largo. Es un catálogo mínimo local, no Storybook.

En un equipo con muchas variantes consideraría [**Storybook**](https://storybook.js.org/docs/get-started/why-storybook) para desarrollar y documentar esos casos aislados. Una página de ejemplos puede bastar al principio. Añadir la herramienta tiene sentido cuando facilita el trabajo compartido, no para cumplir una lista de tecnologías.

Las pruebas de navegador ejercitan el componente dentro del formulario y comprueban que los casos caben en 360 píxeles. Una prueba de **visual regression** añadiría comparación con una imagen aprobada bajo condiciones fijadas: navegador, fuentes, viewport y contenido.

Comparar capturas detecta cambios de apariencia, no decide si son correctos ni si la interfaz funciona con teclado. Por eso no sustituye las pruebas de comportamiento o la revisión de accesibilidad. Este laboratorio no incorpora baselines visuales automáticos.

## Garantías y límites

[El código descargable](/assets/examples/frontend-tiempo-real-lab.zip) prueba un recorrido real con `ActionButton`, estados visibles y layout pequeño. No es una librería publicada ni contiene un catálogo completo, validación de todos los contrastes o auditoría con lectores de pantalla.

Los formularios conservan etiquetas y mensajes fuera del botón. No intentamos resolver errores de negocio mediante un componente genérico que solo puede mostrar «Algo ha fallado».

Desde `frontend-tiempo-real/`, ejecuta `pnpm test:browser --grep "teclado|optimismo|responsive"`. Para revisar variantes manualmente, inicia `pnpm start` y abre la vista `components`.

## Ejercicio: añadir una variante sin romper el formulario

Añade una variante visual de acción secundaria sin cambiar el `type` por defecto ni eliminar el nombre accesible. El botón de navegación no debe enviar el formulario y Guardar debe seguir enviándolo una vez. Documenta cuándo se usa cada variante antes de añadir una tercera.

Hasta aquí hemos controlado cambios iniciados en esta pestaña. Ahora veremos [cómo mantener la vista al recibir eventos y perder la conexión](/posts/sse-websockets-reconexion-eventos-perdidos).

## Referencias

- [React: pasar props a componentes](https://react.dev/learn/passing-props-to-a-component).
- [WAI: nombres accesibles y etiquetas](https://www.w3.org/WAI/tutorials/forms/labels/).
- [Playwright: assertions de estado y comportamiento](https://playwright.dev/docs/test-assertions/).

Fuentes consultadas el 17 de octubre de 2026. Storybook se compara como alternativa; no está instalado en la demo.
