---
id: ARCH-CQRS
title: 'CQRS: separar el modelo de lectura no obliga a separar servicios'
published: 2026-10-21T10:03:00Z
locale: es
translationKey: architecture-cqrs-read-models
slug: cqrs-modelos-lectura-consistencia
draft: true
status: draft
level: intermedio
prerequisites: [ARCH-OWNERSHIP, DOMAIN-EVENTS]
description: 'Construye una proyección de cotizaciones con cursor, replay y detección de huecos. Distingue CQRS, consistencia eventual y Event Sourcing sin introducir un broker o prometer exactly-once.'
author: 'Luis Ramírez Calle'
series: 'Arquitectura: dependencias, módulos y despliegues'
tags: [arquitectura, cqrs, proyecciones, consistencia, typescript, testing]
---

Guardamos una cotización de 500 céntimos y el resumen todavía muestra cero. La escritura no ha fallado: el resumen utiliza otra representación y aún no ha recibido el cambio.

Si elegimos separar esas representaciones, tenemos que explicar qué garantiza cada una y cómo se actualizan. Poner una cola entre ambas no hace desaparecer esa pregunta.

En [ownership del monolito modular](/posts/monolito-modular-ownership-datos-api-publica) distinguimos Shipping y Reporting. Ahora usaremos esa separación para entender **CQRS** sin convertir el ejercicio en una arquitectura distribuida.

## CQRS separa modelos para modificar y consultar

**Command Query Responsibility Segregation** permite utilizar un modelo para decidir y confirmar cambios y otro para responder consultas. [Martin Fowler explica tanto la separación como el riesgo de añadir complejidad donde no hace falta](https://martinfowler.com/bliki/CQRS.html).

En Shipping necesitamos validar una petición, obtener una tarifa y guardar una cotización con su identidad y referencia del proveedor. Reporting solo quiere un contador, un total y un cursor de actualización. No necesita volver a cotizar para sumar.

Eso es más que separar dos interfaces `Reader` y `Writer` sobre el mismo objeto. Aquí la representación de consulta realmente cambia: no devuelve las cotizaciones completas, sino un resumen derivado.

Tampoco implica dos bases de datos. La [documentación del patrón en Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) distingue variantes con almacenamiento compartido y separado. Nuestro ejemplo mantiene ambos modelos en memoria y en el mismo proceso de aplicación.

## Tres decisiones que no conviene meter en el mismo paquete

La primera decisión es separar modelos. La segunda es cuándo actualizar la representación de lectura. La tercera es dónde ejecutarlos y almacenarlos.

Podemos derivar un resumen de forma síncrona y confirmar todo en una transacción de base de datos si los requisitos y el motor lo permiten. O podemos actualizarlo después mediante mensajes. Las dos opciones tienen costes distintos; CQRS no impone por sí solo un retraso observable.

En el laboratorio elegimos actualización diferida manual para hacer visible el estado intermedio. No hay worker autónomo ni espera de red entre Shipping y Reporting. El retraso se expresa en pasos del programa, no en una latencia medida.

## La prueba muestra exactamente qué está confirmado

Archivo: `packages/architecture-boundaries/tests/application.test.mjs`, cuerpo del caso «escritura confirmada no implica proyección actualizada». Los imports y `request` están en el archivo completo.

```javascript
const ledger = memoryLedger()
const summary = createSummary()
await createDeliveryQuote(fixtureProvider(), ledger, 'q-1', request)
assert.equal((await ledger.find('q-1')).amountMinor, 500)
assert.deepEqual(summary.snapshot(), { cursor: 0, count: 0, totalMinor: 0 })
for (const event of ledger.eventsAfter(summary.snapshot().cursor)) summary.apply(event)
assert.deepEqual(summary.snapshot(), { cursor: 1, count: 1, totalMinor: 500 })
```

La primera lectura consulta el registro confirmado. La segunda consulta una proyección que todavía no ha consumido eventos. Después de aplicar el evento, su cursor pasa a 1 y el total a 500.

El resultado de escritura puede informar al usuario de que esa cotización se ha registrado. El resumen tiene otro contrato de frescura. No debemos presentar un total antiguo como prueba de que el cambio se perdió, ni prometer que una proyección siempre refleja la última escritura si no lo hemos garantizado.

<img src="/assets/visuals/architecture-boundaries/ARCH-CQRS.svg" alt="Una cotización de 500 céntimos queda confirmada mientras Reporting conserva cursor cero y total cero; aplicar el primer evento actualiza el modelo de lectura a cursor uno y total 500." width="269" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/architecture-boundaries/ARCH-CQRS.svg).

En una interfaz real podríamos mostrar actualización pendiente, utilizar el resultado confirmado para el detalle o esperar hasta una posición concreta de la proyección. Son decisiones de experiencia y consistencia; este laboratorio no implementa esa UI.

## El cursor permite saber hasta dónde hemos aplicado cambios

El ledger asigna una secuencia global creciente dentro de su instancia. `eventsAfter(cursor)` entrega los eventos posteriores. Reporting conserva el último número aplicado y espera que el siguiente sea exactamente uno más.

Si recibe 2 antes que 1, rechaza el hueco. No salta directamente a 2 ni afirma que está al día. En un consumidor real habría que resolver por qué falta el anterior, reintentar o reconstruir según su contrato de retención.

La proyección valida además tipo de evento, secuencia y cotización antes de cambiar el resumen. Comprueba que la suma sigue siendo un entero seguro. No usa el `number` de TypeScript como garantía suficiente de precisión.

El orden elegido es global porque el fixture es pequeño. Si un sistema repartiese eventos en varias particiones, un único cursor así no representaría automáticamente el progreso de todas. Habría que diseñar la posición y el orden necesarios por cada flujo.

## Replay sin doble conteo no es exactly-once

Una entrega repetida del mismo evento no debería sumar otros 500. El resumen conserva una huella canónica de cada cotización aplicada por secuencia. Si la secuencia ya se procesó con el mismo contenido, devuelve `false` y no cambia el estado.

Si llega la misma secuencia con otro importe, rechaza un replay contradictorio. También rechaza introducir el mismo ID de cotización como un registro nuevo en otra secuencia. Esas condiciones hacen explícito el contrato append-only de este pequeño modelo.

Las pruebas aplican dos cotizaciones, de 500 y 900, y después vuelven a entregar ambas. El resultado sigue siendo contador 2, total 1400 y cursor 2. Otra proyección nueva reconstruye ese resumen a partir de los eventos conservados por la instancia del ledger.

No hay una garantía **exactly-once** distribuida. El resumen y su cursor están en memoria, no se recuperan después de reiniciar y no hay un broker con ACK. Guardar la deduplicación de forma durable y atómica con el cambio sería otro trabajo.

## Tener eventos no convierte el sistema en Event Sourcing

El ledger guarda cotizaciones completas y una lista auxiliar de eventos. No reconstruye su propio estado exclusivamente desde un historial que sea la fuente de verdad. Tampoco modela correcciones, borrados o todas las transiciones posibles de una cotización.

Por eso no lo llamamos **Event Sourcing**. Lo que reconstruimos es una proyección derivada de los eventos que este fixture conserva. CQRS, eventos y Event Sourcing pueden combinarse, pero no son sinónimos.

Si necesitas publicar cambios después de un commit SQL, aparece además el problema de dual writes. La serie ya tiene una entrega de [Outbox e Inbox](/posts/transactional-outbox-inbox-eventos). Este array en memoria no sustituye ese mecanismo durable ni demuestra recuperación tras una caída.

## Cuándo no compensa una proyección adicional

Si una consulta sencilla sobre los datos existentes responde con coste aceptable, mantener otro modelo puede introducir más trabajo que beneficio: sincronización, reconstrucción, retención, evolución del esquema y tratamiento de estados intermedios.

Si las escrituras tienen reglas complejas y las lecturas necesitan una representación muy distinta, la separación puede ser útil. En este ejemplo hace visible el contador y la suma sin exponer las referencias del proveedor en la respuesta del resumen.

No hemos medido que sea más rápido que consultar registros. El criterio del ejercicio es comprender el mecanismo y sus obligaciones, no recomendar una proyección para cualquier dashboard.

## Código completo y pruebas

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/arch-cqrs/README.md), la [proyección completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/architecture-boundaries/src/modules/reporting/internal/projection.ts) y los tests de huecos, replay y reconstrucción.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/architecture-boundaries test
pnpm --dir packages/architecture-boundaries demo
```

## Garantías y límites

La proyección converge si entregamos el historial completo y válido en el orden esperado mientras la instancia sigue viva. Sin ejecutar la entrega manual, no se actualiza sola. La deduplicación y las huellas también crecen en memoria sin una política de retención.

No hay SQL, broker, relay, datos persistentes, Event Sourcing o garantía de progreso ante fallos. Son límites esenciales para no confundir una traza didáctica con una solución operativa.

## Ejercicio: observar un hueco y recuperarlo

Crea tres cotizaciones. Entrega primero el evento 2 y comprueba que el resumen sigue vacío. Después aplica 1, 2 y 3; repite 2 y verifica que el total no cambia. Crea una proyección nueva y reconstruye el mismo resultado desde cero.

La última entrega compara [monolito modular y microservicios](/posts/monolito-microservicios-despliegue-costes). Separar un modelo de lectura puede ser útil sin convertirlo en otro servicio desplegable.

## Referencias

- [Martin Fowler: CQRS](https://martinfowler.com/bliki/CQRS.html).
- [Microsoft Azure Architecture Center: CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).
- [Martin Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html).

Fuentes consultadas el 21 de octubre de 2026. La evidencia describe secuencias locales de ejecución, no mediciones de lag en una plataforma distribuida.
