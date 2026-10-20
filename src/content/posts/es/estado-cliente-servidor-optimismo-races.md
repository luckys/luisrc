---
id: P069
title: 'Estado de cliente y servidor: búsquedas sin carreras y cambios optimistas'
published: 2026-10-17T05:02:00Z
locale: es
translationKey: frontend-server-state-races
slug: estado-cliente-servidor-optimismo-races
draft: true
status: draft
level: intermedio
prerequisites: [P068, API-HTTP]
description: 'Distingue estado local y remoto, evita respuestas antiguas y entiende cuándo un rollback visual deja de ser seguro.'
author: 'Luis Ramírez Calle'
series: 'Frontend y tiempo real'
tags: [frontend, react, typescript, concurrencia]
---

Buscas «entrega», cambias enseguida a «entrega urgente» y la pantalla termina mostrando la primera consulta. Las dos peticiones fueron correctas. El error está en permitir que cualquier respuesta escriba sobre la vista actual.

La pantalla ya [se renderiza e hidrata](/posts/csr-ssr-ssg-hydration-renderizado). Ahora necesitamos decidir quién es dueño de cada dato y qué resultados todavía tienen derecho a cambiarlo. Conviene conocer también los [contratos HTTP](/posts/contratos-http-recursos-operaciones).

## No todo el estado necesita el mismo tratamiento

El texto sin enviar de un formulario es **local state**. Una preferencia usada por varias pantallas podría ser estado compartido. El pedido confirmado pertenece al **server state**: el cliente mantiene una copia que puede quedarse antigua.

Poner las tres cosas en un store global no resuelve sus diferencias. El pedido necesita identidad, política de actualización y tratamiento de conflictos; abrir un menú no suele necesitar nada de eso.

Para una caché de consultas, la clave debe representar la consulta completa: recurso, tenant, filtros, orden y página. Tras una mutación, hay que actualizar o **invalidar** las vistas afectadas. Invalidar significa dejar de tratarlas como actuales y provocar su recuperación según la política elegida, no borrar arbitrariamente todo el estado de la aplicación.

## Abortar trabajo e ignorar resultados son defensas distintas

En el laboratorio, **LatestRequest** aborta la solicitud anterior mediante **AbortController**. Además, asigna una generación a cada búsqueda y solo permite publicar el resultado de la generación vigente.

La segunda defensa sigue siendo útil si un adaptador no atiende la señal o si el trabajo ya terminó. La [API de cancelación](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) permite interrumpir operaciones que la soportan; no deshace una mutación que el servidor ya aplicó.

Archivo: `realtime-frontend/src/state.ts`, invalidación explícita de una búsqueda.

```typescript
  cancel() {
    ++this.generation
    this.controller?.abort()
  }
```

El componente llama a esa cancelación al cambiar la consulta o desmontarse. Usamos un **Effect** para sincronizar con la petición externa, no para copiar constantemente estado que puede calcularse durante el render. React explica este [patrón y sus límites](https://react.dev/reference/react/useEffect).

La prueba unitaria controla cuándo termina cada promesa. Hace llegar primero la respuesta nueva y después la antigua, y exige que permanezca la nueva. Otra comprueba un adaptador que ignora la cancelación. No dependemos de «esperar unos milisegundos y tener suerte».

<img src="/assets/visuals/frontend-series/P069.svg" alt="Un cambio optimista muestra el nombre nuevo mientras el servidor valida la versión; el éxito usa el valor confirmado y el rechazo solo restaura si no hubo otro cambio." width="855" height="865" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/frontend-series/P069.svg).

## Optimistic update significa mostrar una hipótesis

Al guardar un nombre, podemos mostrarlo inmediatamente mientras esperamos confirmación. Esa es una **optimistic update**. Si el servidor rechaza la operación, la pantalla necesita explicar el rechazo y recuperar una representación coherente.

Archivo: `realtime-frontend/src/state.ts`, función completa de la demo.

```typescript
export async function optimisticRename(
  get: () => Order,
  set: (order: Order) => void,
  name: string,
  save: (order: Order) => Promise<Order>,
) {
  const previous = get()
  const optimistic = { ...previous, name }
  set(optimistic)
  try {
    const canonical = await save(optimistic)
    if (get() === optimistic) set(canonical)
  } catch (error) {
    // No restaurar un snapshot sobre un valor que ya ha cambiado por otro camino.
    if (get() === optimistic) set(previous)
    throw error
  }
}
```

`Order` contiene identificador, nombre y versión. El adaptador HTTP envía esa versión; el servidor de laboratorio rechaza una revisión antigua. La interfaz bloquea un segundo guardado mientras espera el primero.

La comparación por referencia impide que este rollback pise una actualización posterior en **este modelo inmutable**. No es un algoritmo general para mutaciones simultáneas, caches normalizadas o ediciones en varios campos.

## Un rechazo conocido y un timeout no significan lo mismo

En un conflicto explícito sabemos que el servidor rechazó ese cambio. Ante una conexión cortada, podría haberlo aplicado antes de perder la respuesta. Revertir la vista no demuestra revertir el servidor.

Para una operación importante, recupera el estado autoritativo o consulta su identidad. En acciones irreversibles, mostrar un estado pendiente suele ser más honesto que anticipar éxito. El problema enlaza con los [resultados desconocidos](/posts/fallos-parciales-timeout-resultado-desconocido).

Para una aplicación real evaluaría una biblioteca de query caching antes de ampliar esta miniimplementación. [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) documenta cancelación de refetches, snapshots e invalidación alrededor de una actualización optimista. También permite recuperar datos en lugar de intentar un rollback local complejo.

## Código del artículo

Consulta los [archivos y pruebas de este post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/p069/README.md). Clona el repositorio y ejecuta los comandos del artículo desde este paquete:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples/packages/realtime-frontend
```

## Garantías y límites

[El laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/realtime-frontend/src/state.ts) prueba selección de la respuesta vigente, rollback, confirmación y conservación de una revisión más reciente. El servidor vive en memoria: reiniciarlo elimina los pedidos modificados. No implementa autenticación, caché multiusuario ni recuperación duradera tras timeout.

Desde `realtime-frontend/`, ejecuta `pnpm test` y `pnpm test:browser --grep "optimismo|búsqueda"`.

## Ejercicio: una respuesta que llega demasiado tarde

Amplía el test de búsqueda con tres peticiones que terminan en orden inverso. Solo la tercera debe publicar resultados. Después desmonta el componente antes de resolverlas: ninguna debería volver a escribir en su vista.

Cuando el comportamiento es correcto, podemos [medir qué parte de la interacción sigue siendo lenta](/posts/rendimiento-frontend-medir-antes-optimizar).

## Referencias

- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
- [React: useEffect y recuperación de datos](https://react.dev/reference/react/useEffect).
- [React: cuándo no necesitas un Effect](https://react.dev/learn/you-might-not-need-an-effect).
- [TanStack Query: optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).

Fuentes consultadas el 17 de octubre de 2026. La demo no utiliza TanStack Query: muestra el mecanismo mínimo y sus límites.
