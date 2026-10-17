---
id: OPS-FAULTS
title: 'Fault injection y pruebas de propiedades: buscar el fallo entre dos pasos'
published: 2026-10-17T04:00:00Z
locale: es
translationKey: reliable-fault-injection
slug: fault-injection-pruebas-propiedades
draft: true
status: draft
level: intermedio
prerequisites: [DIST-RECONCILIATION, DESIGN-TDD]
description: 'Genera secuencias reproducibles e introduce fallos en fronteras concretas. Verifica invariantes, no solo que un escenario termine sin excepciones.'
author: 'Luis Ramírez Calle'
series: 'Probar y operar servicios fiables'
tags: [testing, fault-injection, property-based-testing, resiliencia]
---

La prueba de éxito pasa y la de error también. El fallo aparece cuando el éxito llega dos veces, después de un timeout y seguido de un rechazo atrasado. El problema no estaba en un evento aislado, sino en su secuencia.

Abrimos **Probar y operar servicios fiables** utilizando las reglas de las series anteriores. Necesitas [TDD](/posts/tdd-pruebas-unitarias-integracion-contrato) y [reconciliación](/posts/reconciliacion-operaciones-inciertas). Vamos a buscar interacciones, no a repetir un happy path más grande.

## Una propiedad describe muchos ejemplos

Un caso de prueba dice «desde `processing`, confirmar devuelve `succeeded`». Una **propiedad** puede decir «una vez confirmado un terminal, ninguna acción admitida en este modelo lo hace retroceder».

Podemos generar secuencias y comprobar esa propiedad después de cada paso. No supone que todas las acciones sean válidas: el rechazo también forma parte del contrato. Lo que no podemos hacer es ignorar errores inesperados sin comprobar el estado restante.

<img src="/assets/visuals/reliable-services/OPS-FAULTS.svg" alt="Un generador con semilla produce acciones, la máquina acepta o rechaza cada transición y un oráculo comprueba la invariante después de cada paso; fallos SQL se inyectan entre escrituras." width="940" height="652" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/reliable-services/OPS-FAULTS.svg).

## La semilla permite repetir el recorrido

Archivo: `servicios-fiables/tests/core.test.mjs` (extracto).

```javascript
let seed = 17
const actions = ['submit', 'confirm', 'decline', 'uncertain']
for (let run = 0; run < 100; run++) {
  let state = 'created'
  for (let step = 0; step < 30; step++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const previous = state
    try {
      state = transition(state, actions[(seed >>> 16) % actions.length])
    } catch {}
    if (['succeeded', 'failed'].includes(previous)) assert.equal(state, previous)
  }
}
```

Es un generador pequeño y determinista, no criptográfico. Utilizamos bits altos para no quedarnos con el ciclo corto de los bits inferiores. Las excepciones esperadas conservan `state`, y la propiedad comprueba que un terminal no retrocede.

Este oráculo tiene un límite importante: una implementación que rechazara todo también podría conservar los terminales. Por eso no sustituye los ejemplos de transiciones válidas y sus resultados esperados. Las pruebas se complementan; ninguna es una demostración aislada de corrección completa.

Una herramienta como **fast-check** añade generadores y **shrinking**, la reducción automática de un contraejemplo. Aquí no hacemos shrinking: si aparece una secuencia problemática, conviene reducirla y convertirla en un test de regresión pequeño.

## Inyectar un fallo requiere elegir la frontera

**Fault injection** introduce una condición adversa controlada: una respuesta perdida después del efecto, un error antes del commit o una caída representada entre entrega y confirmación.

La suite SQL provoca una colisión de clave después de insertar una operación y exige que el rollback elimine también esa operación. Otra prueba entrega el evento, deja pendiente la Outbox y lo entrega otra vez. El contador local debe seguir en uno.

No estamos derribando una base de datos ni ejecutando caos en un entorno productivo. Inyectamos fallos lógicos en puntos concretos con datos ficticios. La precisión del punto importa más que llamar «chaos» a cualquier excepción.

## Una matriz de fallos evita huecos

Para cada paso, anota estado persistido antes, efecto posible, observación del cliente y mecanismo de recuperación. Incluye antes y después del commit, después de ejecutar el proveedor y antes de registrar su respuesta, y después de aplicar un evento pero antes de ACK.

Las aserciones deben contar efectos y estados, no únicamente respuestas HTTP. Cien respuestas exitosas pueden corresponder a cien efectos duplicados. Una respuesta incierta puede ser correcta si la evidencia disponible no permite resolverla todavía.

## Garantías y límites

La semilla fija facilita replay, pero explora una parte finita del espacio. Un schedule determinista no representa todos los intercalados del sistema operativo. El laboratorio no ejecuta fuzzing de bytes, mutation testing ni un crash real de proceso.

Antes de fallos reales de infraestructura, utiliza un entorno aislado, un objetivo y condiciones de parada. No hace falta arriesgar datos para descubrir un error que una transacción de prueba ya reproduce.

[Descarga el laboratorio](/assets/examples/servicios-fiables-lab.zip). Desde `servicios-fiables/`:

```bash
node --test --test-name-pattern="secuencias generadas|timeout tras efecto" tests/core.test.mjs
docker compose up -d --wait
node --test tests/postgres.test.mjs
```

## Ejercicio: reducir un contraejemplo

En una copia, permite que `succeeded` pase a `failed`. Guarda la primera secuencia que lo detecte y redúcela a las acciones indispensables. La regresión mínima debe seguir fallando sin depender del generador.

Ahora necesitamos ver esas operaciones cuando dejan de ser tests: [logs, métricas y trazas](/posts/observabilidad-logs-metricas-trazas-workers).

## Referencias

- [fast-check: property-based testing](https://fast-check.dev/docs/introduction/).
- [Node.js 24: ejecución y aislamiento de tests](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Principles of Chaos Engineering](https://principlesofchaos.org/).

Fuentes consultadas el 17 de octubre de 2026. El laboratorio utiliza generación propia, no fast-check.
