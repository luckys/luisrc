# Frontend y tiempo real

Laboratorio local de nueve artículos en español. React 19.2.0, TypeScript 5.9.2,
Yjs 13.6.27 y Playwright 1.56.1. Requiere Node >=24 y pnpm 12.8.1.
Las versiones fijan el experimento; no son una recomendación de versiones para producción.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
pnpm typecheck
pnpm test:browser
pnpm start
```

El servidor escucha **solo en 127.0.0.1:4399**. Detener con Ctrl+C.
Playwright inicia y cierra su propio servidor; no dejes `pnpm start` abierto
al ejecutar las pruebas. La descarga incluye un lockfile independiente.
En algunos sistemas puede ser necesario instalar dependencias del navegador
siguiendo la documentación de Playwright; no se instalan paquetes del sistema automáticamente.

El `pnpm-workspace.yaml` local permite únicamente el build de esbuild, necesario
para su ejecutable nativo. La instalación autónoma no depende de permisos de build
heredados del repositorio del blog.

## Vistas

| Artículo | Ruta                              | Qué comprobar                                    |
| -------- | --------------------------------- | ------------------------------------------------ |
| P067     | `/?view=orders`                   | Tab, enlace de salto, etiqueta, guardar y estado |
| P068     | `/?mode=ssr` y `/?mode=csr`       | HTML inicial sin JavaScript y edición después    |
| P069     | `/?view=orders` y `/?view=search` | Rechazo optimista y búsqueda vigente             |
| P070     | `/?view=performance`              | DOM acotado; microexperimento separado           |
| P071     | `/?view=table`                    | 20 filas desde API; siguiente página y foco      |
| P072     | `/?view=components`               | Vacío, texto largo, pendiente, desactivado       |
| P073     | `/?view=events`                   | Generar, desconectar y recuperar secuencias      |
| P074     | `/?view=note` en dos pestañas     | Desconectar ambas, añadir A/B y reconectar       |
| P075     | `/?view=media`                    | Micrófono local, paquetes recibidos y colgar     |

Para probar audio manualmente usa auriculares. La prueba automatizada usa
un micrófono sintético de Chromium y no graba archivos. Dos peer connections
residen en una página: no es una llamada remota, no usa STUN ni TURN.

## Experimento de coste DOM

```bash
pnpm exec node tools/measure-dom.mjs
```

Sustituye `results/dom.json`. Crear 5.000 filas frente a una ventana de 14,
una ronda de calentamiento y siete medidas alternadas, viewport 1280×720,
Chromium headless. Se mide creación de nodos y layout síncrono, **no INP**, React,
scroll, rasterización completa ni experiencia de campo. Entorno y muestras en JSON.
El renderizador de gráficas del repositorio lee ese archivo; los artículos conservan
el resumen de la ejecución revisada y no se actualizan solos al medir otra máquina.

## Límites deliberados

- Servidor de demostración sin autenticación, autorización o rate limiting. **No exponer a Internet**.
- Pedidos, colección de fixtures e historia SSE están en memoria. Reiniciar pierde cambios.
- Un rechazo HTTP permite demostrar rollback; un timeout real requiere reconciliación.
- Las respuestas de esta API ficticia se tratan como contrato conocido. Para una API externa,
  validar el JSON en runtime antes de introducirlo en estado; las anotaciones no lo validan.
- La lista virtual calcula nombres visibles de posiciones ficticias. La colección completa
  de entregas existe solo en el servidor; la tabla paginada pide grupos de 20.
- La selección global se modela y prueba, pero no hay UI ni endpoint de acción masiva.
- SSE tiene diez eventos retenidos y snapshot de un contador, no una proyección de pedidos.
  No controla consumidores lentos ni garantiza continuidad tras reiniciar el proceso.
- BroadcastChannel conecta pestañas del mismo origen, no equipos. El botón desconecta
  el adaptador, no la red. localStorage conserva un snapshot didáctico: dos escrituras
  concurrentes pueden sobrescribirse antes de sincronizar. No es un proveedor offline duradero.
- La nota solo añade fragmentos. No implementa borrado, edición rica, awareness o permisos.
- El catálogo de componentes no usa Storybook ni baselines automáticos de visual regression.
- Las pruebas de teclado y reflow no certifican WCAG. Falta revisión con tecnologías de asistencia
  y navegadores/dispositivos adicionales.

## Archivos

`src/state.ts`: solicitudes vigentes y optimismo. `src/data.ts`: ventana,
selección y secuencias. `src/components.tsx`: contratos de componentes.
`src/collaboration.ts`: adaptador Yjs. `src/media.ts`: recursos WebRTC.
`src/App.tsx`: interacción React. `tools/server.mjs`: SSR, API y SSE local.
`tests/core.test.mjs`: modelos deterministas. `tests/browser/app.spec.ts`: integración real.
