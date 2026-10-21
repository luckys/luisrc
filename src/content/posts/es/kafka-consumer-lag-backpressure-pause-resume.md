---
id: KAFKA-PRESSURE
title: 'Consumer lag y backpressure: que Kafka guarde el trabajo no aumenta tu capacidad'
published: 2026-10-21T12:04:00Z
locale: es
translationKey: kafka-lag-backpressure
slug: kafka-consumer-lag-backpressure-pause-resume
draft: true
status: draft
level: intermedio
prerequisites: [KAFKA-REPLAY]
description: 'Observa lag de checkpoints y pause/resume con Kafka real. Distingue posiciones y mensajes y limita el trabajo que entra al handler sin atribuir capacidad infinita al broker.'
author: 'Luis Ramírez Calle'
series: 'Kafka: logs, consumidores y reconstrucción de estado'
tags: [kafka, lag, backpressure, observabilidad, concurrencia, typescript]
---

El consumidor recibe eventos más rápido de lo que su base de datos puede aplicarlos. Si lanzamos una promesa por registro sin límite, el backlog no desaparece: una parte empieza a acumularse dentro de nuestro proceso.

Kafka puede conservar trabajo pendiente, pero no aumenta por sí solo la capacidad del destino. Necesitamos observar el avance y limitar qué trabajo aceptamos simultáneamente.

Después de [offsets, commits y replay](/posts/kafka-offsets-commits-reconstruir-proyeccion), ya distinguimos lectura y checkpoint. Esa diferencia resulta esencial para interpretar **consumer lag** sin confundir un número bajo con una aplicación al día.

## Lag compara posiciones, no demuestra frescura de negocio

Una medida habitual compara la posición final disponible de una partición con el **committed offset** del grupo. En el fixture hay registros 0, 1 y 2; la posición final es 3. Si el checkpoint está en 0, la diferencia es 3.

Después de aplicar 0 y confirmar 1, la diferencia pasa a 2. Al confirmar 3 llega a 0. Hablamos de lag del checkpoint: el cliente también puede haber fetched datos que aún no ha procesado o confirmado.

Archivo: `packages/kafka-streaming/src/offsets.ts`. `offset` valida strings decimales y los convierte mediante BigInt.

```typescript
export function offsetLag(end: string, committed: string | null): string | null {
  const high = offset(end)
  if (committed === null) return null
  const low = offset(committed)
  if (low > high) throw new Error('commit_ahead_of_end')
  return (high - low).toString()
}
```

Si no hay checkpoint, devolvemos `null`, no suponemos que equivale a cero. KafkaJS puede representar su ausencia con `-1` en la consulta administrativa; antes de usar el helper hay que traducir ese estado a `null`, no tratarlo como una posición válida.

La diferencia de offsets tampoco coincide necesariamente con el número de registros pendientes: puede haber huecos. Las [métricas oficiales de Kafka](https://kafka.apache.org/39/operations/monitoring/) sitúan el lag dentro de un conjunto mayor de observaciones, no como indicador universal aislado.

## El agregado puede esconder la partición problemática

Un topic puede tener muchas particiones vacías y una con atraso creciente. El promedio puede parecer aceptable mientras esa última retrasa todos los cambios de una key importante.

Conviene observar cada partición y relacionar su avance con antigüedad, errores, recursos y latencia del destino. Tiempo desde el último procesamiento correcto y diferencia de posiciones responden preguntas distintas.

Lag cero tampoco prueba que una vista sea correcta. Si confirmamos antes de aplicar, podemos declarar avance y dejar trabajo sin hacer. Si el destino sirve una caché antigua, el checkpoint no mide esa propagación posterior.

En esta prueba el productor termina antes de medir y conocemos tres registros consecutivos. Eso hace inequívoca la secuencia 3 → 2 → 0, sin convertirla en un monitor completo de producción.

## Pause limita el consumo local, no detiene al productor

KafkaJS permite pausar particiones y reanudarlas. Usamos `pause` del contexto del handler, que devuelve una función `resume`. La [documentación del cliente](https://kafka.js.org/docs/consuming#pause--resume) concreta su alcance.

La pausa no ordena al productor que deje de publicar ni elimina registros. Tampoco significa que el cliente nunca haya precargado bytes. Aquí **backpressure** limita el avance de nuestro trabajo de aplicación, no regula todo el sistema de extremo a extremo.

Una regulación completa necesitaría admisión, cuotas, capacidad del almacenamiento, límites del destino y comportamiento ante retención agotada. El consumidor fija además límites de fetch, pero eso no demuestra consumo constante de memoria con cualquier carga.

## Una barrera controlada muestra el trabajo en curso

Archivo: `tests/broker.test.mjs`, callback del caso de presión. `entered` señala la llegada del primer registro y `release` permite terminar. Son promesas controladas por el test.

```javascript
onRecord: async (record, context) => {
  seen++
  if (record.offset === '0') { resume = context.pause(); entered.resolve(); await release.promise }
}
```

El test consulta al broker después de entrar: end 3, commit 0, lag 3. Solo se ha iniciado un handler. Libera la barrera y espera a observar commit 1. El consumidor sigue pausado y el contador de handlers continúa en uno.

Después llama a `resume`, procesa 1 y 2 y observa commit 3, lag 0. Las consultas verifican el checkpoint real, no un contador local que asume que el commit funcionó.

<img src="/assets/visuals/kafka-streaming/KAFKA-PRESSURE.svg" alt="El log termina en posición tres y el grupo empieza en cero; el handler pausa al recibir cero, confirma uno al terminar y conserva lag dos hasta reanudar, procesar uno y dos y confirmar tres." width="275" height="724" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/kafka-streaming/KAFKA-PRESSURE.svg).

La barrera permite observar estados intermedios repetibles, no medir el rendimiento de una base de datos. No usamos una espera arbitraria para asumir que el trabajo seguramente terminó.

## Esperar el handler evita otra cola sin límite

Si el handler espera al destino antes de retornar, conserva una secuencia controlada de trabajo. Si dispara una escritura y retorna inmediatamente, el cliente puede avanzar mientras crecen las promesas pendientes.

Retornar antes también puede romper la relación entre commit y efecto: el callback parecería completado aunque la escritura no lo esté. El lag bajo describiría ese checkpoint adelantado, no un destino al día.

Podemos usar concurrencia acotada cuando el orden y el destino lo permiten. Hay que decidir cuántas tareas caben y hasta dónde puede confirmarse sin saltar una anterior pendiente. Si terminaron 0 y 2 pero 1 sigue en curso, no basta con confirmar la tarea más adelantada.

## La pausa no elimina las obligaciones del grupo

Una espera larga debe respetar los mecanismos temporales del cliente. KafkaJS expone heartbeat en el contexto; una implementación real necesita saber cuándo usarlo y qué hacer si pierde la asignación.

Aquí liberamos la barrera después de consultar estados, no la mantenemos durante minutos. No probamos supervivencia a una tarea más larga que el timeout de sesión. Bloquear el event loop también impediría ejecutar otras tareas necesarias: un temporizador no arregla un cálculo síncrono que no le deja correr.

Un error o pérdida de asignación exige decidir retries y conservar el checkpoint correcto. Pause no sustituye esas políticas ni aporta deduplicación durable.

## Para recuperar backlog, la capacidad debe superar la entrada

Como ejemplo hipotético, si entran diez eventos por segundo y procesamos ocho, se añaden dos pendientes por segundo mientras se mantenga esa diferencia. Guardarlos en otro sitio cambia dónde esperamos, no la relación.

Para recuperar atraso hay que procesar por encima de la entrada durante suficiente tiempo, reducirla o cambiar el trabajo. Más consumidores solo ayudan si quedan particiones repartibles y el cuello de botella admite capacidad adicional.

Si todos escriben al mismo destino saturado, añadir consumidores puede empeorarlo. Si una key concentra carga, más particiones no dividen automáticamente su secuencia. Además, recuperar velocidad demasiado tarde no devuelve un prefijo ya eliminado por retención.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/kafka-pressure/README.md), el [consumidor acotado](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/kafka-streaming/src/collect.ts) y el test de pause/resume con consultas reales.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/kafka-streaming test
pnpm --dir packages/kafka-streaming broker:up
pnpm --dir packages/kafka-streaming test:integration
pnpm --dir packages/kafka-streaming broker:down
```

La imagen fijada debe estar disponible según el README. `evidence/broker.json` se guarda solo si los cinco casos de integración pasan.

## Garantías y límites

Observamos end 3, commits 0/1/3 y lag de posiciones 3/2/0. Pausado después del primer commit, no empieza otro handler. Resume permite completar el fixture.

Sin benchmark, carga sostenida, memoria perfilada, productor regulado o destino real saturado. Un broker y consumidor en loopback no prueban capacidad, recuperación ante pérdida de asignación o tolerancia distribuida.

## Ejercicio: medir antes de escalar

Una partición tiene lag creciente y las demás están al día. Enumera qué observarías para distinguir una key caliente, una consulta lenta y falta de capacidad general. Explica en qué casos añadir consumidores podría no ayudar.

Después revisa un handler: ¿cuándo considera terminado el trabajo y quién limita lo que queda en curso? Esa respuesta permite interpretar el lag antes de ajustar un umbral de alerta.

## Referencias

- [Apache Kafka 3.9: monitorización](https://kafka.apache.org/39/operations/monitoring/).
- [KafkaJS: pause y resume](https://kafka.js.org/docs/consuming#pause--resume).
- [KafkaJS: offsets del topic y del grupo](https://kafka.js.org/docs/admin).

Fuentes consultadas el 21 de octubre de 2026. Las cifras de capacidad son hipotéticas; los offsets son resultados del fixture.
