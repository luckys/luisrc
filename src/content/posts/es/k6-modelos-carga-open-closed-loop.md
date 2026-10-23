---
id: PERF-MODELS
title: 'Open-loop y closed-loop con k6: quién decide cuándo llega la siguiente petición'
published: 2026-10-22T10:01:00Z
locale: es
translationKey: performance-load-models
slug: k6-modelos-carga-open-closed-loop
draft: true
status: draft
level: intermedio
prerequisites: [P058]
description: 'Compara usuarios que esperan con una tasa de llegadas independiente. Ejecuta k6 local, interpreta dropped_iterations y evita atribuir al servidor una falta de capacidad del generador.'
author: 'Luis Ramírez Calle'
series: 'Medir rendimiento: carga, benchmarks y profiling sin conclusiones falsas'
tags: [performance, k6, load-testing, concurrency]
---

Configuramos cien usuarios y el servidor se vuelve más lento. El generador también reduce sus peticiones: cada usuario está esperando la respuesta anterior. ¿Hemos mantenido la presión que queríamos medir?

Depende de la pregunta. Cien personas que esperan y cien llegadas por segundo son dos cargas distintas. Elegir el modelo equivocado puede hacer que una prueba deje de enviar trabajo justo cuando el sistema empieza a tener dificultades.

Después de [definir latencia y percentiles](/posts/latencia-percentiles-histogramas-errores), vamos a controlar las llegadas con **k6 2.3.0**. El servicio escuchará únicamente en loopback y vivirá en un proceso Node.js distinto del generador.

## Closed-loop mantiene clientes, no una tasa fija

En un modelo **closed-loop**, cada cliente completa una iteración antes de empezar la siguiente. Si una iteración contiene una petición, ese usuario virtual espera su respuesta antes de repetirla.

Con cuatro **virtual users**, o **VUs**, y respuestas de unos cuarenta milisegundos, esperamos un orden de magnitud cercano a cien peticiones por segundo si no hay pausas adicionales. Es una aproximación a partir de las condiciones del ejemplo, no una garantía del executor.

Si las respuestas pasan a tardar ochenta milisegundos, los mismos cuatro clientes producirán menos peticiones. Eso representa bien una población fija que espera. No representa una fuente externa que sigue enviando a la misma tasa mientras el servicio se retrasa.

No hay un modelo universalmente correcto. Lo incorrecto es presentar el resultado de uno como respuesta a la pregunta del otro.

## Open-loop intenta mantener las llegadas

En **open-loop**, el calendario de inicio no depende de que termine la iteración anterior. En nuestro caso, `constant-arrival-rate` intenta empezar cien iteraciones por segundo y utiliza VUs libres para ejecutarlas.

El script hace una petición por iteración. Con ese supuesto, iteraciones por segundo y peticiones iniciadas por segundo están relacionadas directamente. Si añadiéramos login, varias llamadas o un retry dentro de la iteración, esa equivalencia desaparecería.

Extracto de `k6/load.js`:

```javascript
  scenarios: { measured: mode === 'open' ? {
    executor: 'constant-arrival-rate', rate, timeUnit: '1s', duration: `${seconds}s`,
    preAllocatedVUs: vus, maxVUs: vus, gracefulStop: '3s',
  } : { executor: 'constant-vus', vus, duration: `${seconds}s`, gracefulStop: '3s' } },
```

Es parte de `options`; `mode`, `rate`, `seconds` y `vus` se validan antes. En el escenario abierto reservamos cuarenta VUs y no permitimos aumentar ese máximo durante la ejecución. Así el límite del generador queda explícito.

La llegada se distribuye a lo largo del intervalo. Cien por segundo no significa lanzar cien peticiones juntas al principio de cada segundo. Una ráfaga simultánea sería otro experimento.

<img src="/assets/visuals/performance/PERF-MODELS.svg" alt="Closed-loop espera con cuatro usuarios virtuales; open-loop programa cien iteraciones por segundo y necesita VUs disponibles; el fixture vive en otro proceso y distingue peticiones enviadas de iteraciones descartadas." width="365" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/performance/PERF-MODELS.svg).

## El generador también puede quedarse sin capacidad

Supongamos que cada petición ocupa un VU durante cuarenta milisegundos. Un solo VU no puede mantener cien inicios por segundo si cada nueva iteración necesita uno libre.

En esa configuración aparecen **dropped_iterations**: iteraciones que no llegaron a iniciarse. No son respuestas HTTP 503. El servidor no recibió una petición que pudiera rechazar.

El laboratorio contiene intencionadamente ese caso, `generator-starved`. Su expectativa exige iteraciones descartadas y ninguna respuesta de error. Sirve para no confundir falta de VUs con un fallo observado del endpoint.

Si aparecen descartes, hay que investigar tanto la configuración del generador como el tiempo que mantiene ocupados sus VUs. Una respuesta cada vez más lenta también puede agotar los huecos disponibles. Aumentar VUs sin revisar recursos o latencias puede trasladar el problema, no explicarlo.

## Una respuesta 200 tampoco basta como check

Nuestro endpoint devuelve el body literal `ok`. La iteración valida ambas cosas:

```javascript
export default function () {
  const response = http.get(`${base}/work`, { timeout: '2s', tags: { name: '/work' } })
  check(response, { 'successful work': (r) => r.status === 200 && r.body === 'ok' })
}
```

El código importa `http` de `k6/http` y `check` de `k6`. Es JavaScript del runtime de k6, no un script que pueda ejecutarse sin más con Node.js. El servicio que recibe las peticiones sí está escrito en TypeScript.

Los **checks** producen métricas. Los **thresholds** convierten condiciones sobre esas métricas en un resultado de aceptación o fallo de la prueba. El script exige pocos errores, checks correctos y cero iteraciones descartadas; las fases adversas incumplen deliberadamente algunas de esas condiciones.

El wrapper no acepta cualquier salida no cero como hallazgo. Exige el código esperado y contrasta que realmente hubo rechazos o descartes, según el escenario. Un error de configuración no se convierte en una prueba de saturación.

## Qué nos permite comparar este experimento

El fixture admite ocho operaciones simultáneas y cada una espera cuarenta milisegundos. Con cuatro VUs cerrados se mantiene por debajo de ese límite. Con cien llegadas abiertas por segundo y VUs suficientes también lo hace en la ejecución archivada.

Las tasas observadas son parecidas, pero los contratos de carga no lo son. Si el tiempo del servicio aumentara, el modelo cerrado reduciría automáticamente sus inicios; el abierto intentaría sostenerlos hasta alcanzar sus propios límites.

La prueba no ha medido una infraestructura remota. Separar procesos evita que un mismo event loop controle cliente y servidor, pero ambos siguen compartiendo CPU, memoria y sistema operativo en una máquina.

## Código completo y pruebas

[Índice de esta entrega](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/perf-models/README.md) y [script completo de k6](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/performance-lab/k6/load.js).

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/performance-lab tools:install
pnpm --dir packages/performance-lab measure:load
```

`tools:install` descarga el binario oficial Linux x64 fijado y comprueba su SHA-256. No instala k6 globalmente. `measure:load` solo admite el fixture propio en `127.0.0.1`, limita tasa, duración y VUs y cierra sus procesos. No inicia servicios cloud, envía métricas a un backend ni habilita el informe de uso.

## Garantías y límites

Se ejecutaron ambos modelos, el caso de generador limitado y los checks reales del body. No hicimos generación distribuida ni comprobamos que esta máquina pudiera producir cualquier tasa mayor.

Tampoco demostramos ausencia de **coordinated omission** en cualquier medición. Lo esencial aquí es no perder presión externa por haberla modelado como clientes que esperan. Si ese comportamiento de espera representa a los usuarios reales, el modelo cerrado puede ser precisamente el adecuado.

## Ejercicio: cambiar la unidad de carga

Añade una segunda petición dentro de cada iteración. Antes de ejecutarla, explica qué significa ahora `rate: 100` y cuántos requests esperas intentar. Revisa también el timeout, los checks y los percentiles: una iteración y una petición ya no miden lo mismo.

Ahora podemos estudiar [saturación y recuperación](/posts/saturacion-stress-testing-admision-recuperacion) sin confundir presión programada, trabajo enviado y trabajo aceptado.

## Referencias

- [k6: open y closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/).
- [k6: constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/).
- [k6: dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/).
- [k6: thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/).

Fuentes consultadas el 22 de octubre de 2026. Versión fijada para reproducibilidad, no requisito de usar siempre esa versión.
