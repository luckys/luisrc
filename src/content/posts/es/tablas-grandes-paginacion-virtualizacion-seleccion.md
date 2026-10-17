---
id: P071
title: 'Tablas grandes: paginación, virtualización y qué significa seleccionar todo'
published: 2026-10-17T05:04:00Z
locale: es
translationKey: frontend-large-tables
slug: tablas-grandes-paginacion-virtualizacion-seleccion
draft: true
status: draft
level: intermedio
prerequisites: [P070, API-EVOLUTION]
description: 'Diseña vistas de muchos registros sin confundir paginación con virtualización ni selección visible con una operación sobre todo el filtro.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, tablas, accesibilidad, paginacion]
---

La tabla muestra 20 entregas y el usuario pulsa «Seleccionar todo». ¿Ha seleccionado esas 20, las 100.000 del sistema o todas las que cumplen el filtro, incluidas las que todavía no se han creado? Un checkbox aparentemente sencillo puede esconder tres contratos distintos.

Después de [medir el coste de montar demasiadas filas](/posts/rendimiento-frontend-medir-antes-optimizar), necesitamos separar volumen de datos, volumen de DOM y alcance de las acciones. Conviene revisar también la [paginación por cursor](/posts/evolucion-api-paginacion-contratos).

## Paginación y virtualización resuelven problemas diferentes

La **server pagination** limita qué registros recuperamos. El servidor filtra y ordena antes de devolver una página. En el laboratorio conserva 100.000 entregas ficticias y entrega 20 por petición. La página siguiente recupera otro grupo.

La **virtualization** limita qué filas están montadas en el DOM. Puede usarse con una colección local o con datos recuperados por páginas. No implica por sí sola descargar menos información.

La demo virtual no descarga 100.000 objetos: calcula el texto de las posiciones visibles. Es una simplificación deliberada para estudiar la ventana. La vista paginada sí consulta el endpoint de entregas. Ninguna simula una base de datos de producción.

<img src="/assets/visuals/frontend-series/P071.svg" alt="Un conjunto de 100.000 entregas puede consultarse por páginas de 20 y mostrarse en tabla nativa; una ventana virtual limita nodos, pero no define cómo se recuperan los datos." width="826" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P071.svg).

## Una ventana necesita geometría y margen

Para filas de altura fija, la primera posición visible es aproximadamente `floor(scrollTop / rowHeight)`. Montamos además algunas filas antes y después, el **overscan**, para reducir apariciones durante el scroll.

Archivo: `frontend-tiempo-real/src/data.ts`, cálculo del intervalo tras validar los argumentos.

```typescript
const first = Math.min(total, Math.floor(scrollTop / rowHeight))
return {
  start: Math.max(0, first - overscan),
  end: Math.min(total, Math.ceil((scrollTop + height) / rowHeight) + overscan),
}
```

El extremo `end` no está incluido. Con altura de 320 píxeles, filas de 32 y overscan de 2, al principio montamos 12 filas. Las pruebas comprueban principio, final y colección vacía. Si el texto cambia la altura real, este cálculo deja de describir la pantalla: una biblioteca con medición dinámica puede ser una mejor elección.

La virtualización complica buscar con el navegador, navegar con tecnologías de asistencia y mantener foco sobre elementos desmontados. Por eso ofrecemos una alternativa paginada con tabla HTML. No declaramos «accesible» una lista solo porque tenga `tabIndex`.

## Filtrar y ordenar debe tener significado global

Ordenar únicamente las 20 filas descargadas no equivale a ordenar las 100.000. El contrato tiene que indicar qué parte del conjunto se ha consultado y con qué criterio.

En datos que cambian, un orden necesita desempate estable, por ejemplo `(created_at, id)`. **Keyset pagination** evita algunos problemas de desplazamiento y coste del offset, pero no crea automáticamente un snapshot inmutable. El artículo de contratos desarrolla esa diferencia.

El servidor de esta demo usa índices de página sobre una colección fija para mantener el experimento pequeño. No demuestra coste constante en SQL ni comportamiento bajo inserciones concurrentes. Para trasladarlo a datos vivos habría que probar esas condiciones.

## Seleccionar un filtro es distinto de enumerar IDs

Una selección explícita conserva identificadores concretos. Una selección global puede conservar una descripción del filtro y excepciones.

Archivo: `frontend-tiempo-real/src/data.ts`, tipos del modelo de selección.

```typescript
export type Selection =
  | { kind: 'explicit'; ids: Set<string> }
  | { kind: 'all'; filter: string; excluded: Set<string> }
```

El helper probado solo considera seleccionado un registro si coincide el fingerprint del filtro y no está excluido. Al cambiar de filtro no arrastramos silenciosamente «todo» a otra consulta.

Para ejecutar una acción masiva real, el servidor debe volver a autorizar y definir el conjunto: ¿evaluación al iniciar el trabajo o snapshot congelado con IDs? Una cadena `pending@v1` no implementa ese snapshot. Aquí representa una identidad didáctica; el contrato de backend queda por construir.

Si llegan **streaming updates**, mover filas bajo el cursor puede ser molesto. Una alternativa es avisar de cambios disponibles y dejar que el usuario refresque. Para acciones destructivas conviene mostrar cantidad, alcance y confirmación antes de encolar trabajo.

## La tabla no tiene que convertirse en una hoja de cálculo

El componente utiliza `caption`, cabeceras y filas normales. Un patrón ARIA **grid** exige otra interacción. WAI distingue el [patrón table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) de los widgets que gestionan navegación entre celdas.

Al completar una navegación hacia delante, enfocamos el título de la nueva página. Un estado de carga y un mensaje de error explican qué ocurre. No añadimos controles de selección masiva al ejemplo: el modelo de selección se prueba por separado para no insinuar que ya existe una operación de backend.

## Garantías y límites

[El laboratorio](/assets/examples/frontend-tiempo-real-lab.zip) prueba DOM acotado con 100.000 posiciones, páginas de 20 y alcance de selección por filtro. No implementa cursor persistente, acciones masivas, filtros SQL o una lista virtual apta para cualquier tecnología de asistencia.

Desde `frontend-tiempo-real/`: `pnpm test` y `pnpm test:browser --grep "virtualización|paginación"`.

## Ejercicio: cambiar el filtro sin cambiar la intención

Selecciona `pending@v1`, excluye `d2` y consulta después `done@v1`. Ninguna fila de la segunda consulta debe heredar la selección global anterior. Define además si regresar al primer filtro recupera la selección o la descarta, y escribe el test que fija esa decisión.

La siguiente lectura trata de [extraer componentes sin esconder estos contratos](/posts/componentes-design-system-contratos-estados).

## Referencias

- [WAI: patrón de tabla](https://www.w3.org/WAI/ARIA/apg/patterns/table/).
- [React: renderizar listas y conservar identidad](https://react.dev/learn/rendering-lists).
- [PostgreSQL: LIMIT y OFFSET](https://www.postgresql.org/docs/18/queries-limit.html).

Fuentes consultadas el 17 de octubre de 2026. Los 100.000 registros son fixtures locales, no datos de clientes.
