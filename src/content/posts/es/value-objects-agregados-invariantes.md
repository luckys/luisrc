---
id: DOMAIN-AGGREGATES
title: 'Agregados: elegir la frontera que protege una invariante'
published: 2026-10-20T09:04:00Z
locale: es
translationKey: domain-value-objects-aggregates
slug: value-objects-agregados-invariantes
draft: true
status: draft
level: intermedio
prerequisites: [DOMAIN-VALUES, DOMAIN-ENTITIES]
description: 'Elige una frontera de consistencia para pagos y reservas de devolución. Protege invariantes dentro del agregado sin confundir encapsulación con control de concurrencia.'
author: 'Luis Ramírez Calle'
series: 'Modelar el dominio y comunicar la arquitectura'
tags: [ddd, aggregate, invariantes, typescript, testing]
---

Un pago de 100 euros ya tiene 70 reservados para una devolución. Otra solicitud pide 40. Los dos importes son válidos por separado, pero no pueden aceptarse juntos si las reservas no deben superar lo capturado.

El [Value Object Money](/posts/value-objects-igualdad-inmutabilidad) ya protege cantidad y moneda. Ahora necesitamos una responsabilidad distinta: conocer las reservas existentes y decidir si la siguiente cabe en el importe disponible.

Un **agregado** permite establecer esa frontera de decisión. La elegiremos desde la regla, no desde todas las relaciones que podría devolver un ORM. Las entidades y los valores tienen sus propias entregas; aquí nos centramos en qué debe mantenerse coherente.

## Un agregado agrupa lo que debe decidirse de forma coherente

Un **agregado** establece una frontera para proteger invariantes. Su **aggregate root** es la entrada que coordina las modificaciones. En este ejercicio `Payment` controla las reservas de devolución asociadas a un pago.

No incluimos al cliente, la dirección de envío o todos los pedidos del comprador. Esos datos no hacen falta para comprobar esta regla:

**Importe reservado acumulado + nueva solicitud ≤ importe capturado.**

El tamaño del agregado responde a esa necesidad de coherencia, no a copiar todas las relaciones del diagrama SQL. [Vaughn Vernon desarrolla este criterio de consistencia y tamaño](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf) al revisar diseños de agregados.

<img src="/assets/visuals/domain-design/DOMAIN-AGGREGATES.svg" alt="El pago conserva el importe capturado y las reservas de devolución; la entrada requestRefund comprueba moneda, identidad y límite antes de crear un nuevo estado y un evento." width="247" height="572" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/domain-design/DOMAIN-AGGREGATES.svg).

## Cambiar de estado solo después de comprobar la regla

`Payment.capture` crea un pago con importe positivo y sin reservas. Su constructor conserva copias privadas de las reservas, de modo que el consumidor no recibe el `Map` interno para editarlo directamente.

El método decisivo recibe un identificador de solicitud y un importe. Archivo: `packages/domain-design/src/domain.ts`, dentro de `Payment`.

```typescript
  requestRefund(refundId: string, amount: Money): RefundDecision {
    requireId(refundId)
    if (amount.currency !== this.captured.currency) throw new Error('currency mismatch')
    if (amount.minor === 0) throw new Error('refund must be positive')
    if (this.#refunds.has(refundId)) throw new Error('duplicate refund id')
    if (amount.minor > this.captured.minor - this.reservedMinor) throw new Error('refund limit')
    const refunds = new Map(this.#refunds)
    refunds.set(refundId, amount)
    return Object.freeze({
      next: new Payment(this.id, this.captured, refunds),
      event: Object.freeze({
        type: 'RefundRequested', paymentId: this.id, refundId,
        minor: amount.minor, currency: amount.currency,
      }),
    })
  }
```

`requireId` admite entre 1 y 64 caracteres alfanuméricos o guiones. `reservedMinor` suma las reservas existentes. La comparación usa el saldo restante antes de sumar para no necesitar un acumulado intermedio fuera del rango seguro.

Rechazamos una moneda distinta, cero, un ID repetido y un importe superior al disponible. Solo después se construyen el estado nuevo y el hecho `RefundRequested`.

El objeto original no se modifica. Si la operación falla, quien tenía una referencia al pago anterior sigue viendo el mismo estado. Si tiene éxito, todavía hay que guardar `next`: construirlo no lo convierte en el estado confirmado del sistema.

El nombre del evento importa. Describe que se ha decidido solicitar un reembolso, no que el dinero haya llegado al comprador. La diferencia entre construir, confirmar y publicar un hecho se desarrolla en [domain events](/posts/domain-events-hechos-confirmacion).

## El test comprueba comportamiento, no el número de clases

Archivo: `packages/domain-design/tests/domain.test.mjs`, extracto del caso del límite.

```javascript
const original = Payment.capture('p1', new Money(10000, 'EUR'))
const first = original.requestRefund('r1', new Money(7000, 'EUR'))
assert.equal(original.reservedMinor, 0)
assert.equal(first.next.reservedMinor, 7000)
assert.throws(() => first.next.requestRefund('r2', new Money(4000, 'EUR')), /limit/)
assert.equal(first.next.reservedMinor, 7000)
assert.equal(
  first.next.requestRefund('r2', new Money(3000, 'EUR')).next.reservedMinor,
  10000,
)
```

El caso acepta el límite exacto, rechaza superarlo y comprueba que un fallo no deja una modificación parcial. Otros tests cubren igualdad de valores, monedas distintas, cero, ID repetido y precisión numérica.

Las pruebas se escribieron antes de la implementación. El primer intento falló por ausencia de los módulos; después se ejecutaron los casos sobre el código construido. No utilizamos una DB para demostrar una regla que no depende de ella.

Consulta el [índice del post](https://github.com/luckys/luisrc-blog-examples/blob/main/posts/es/domain-aggregates/README.md) y la [implementación completa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/src/domain.ts). Archivo: terminal.

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/domain-design test
pnpm --dir packages/domain-design typecheck
```

## Un agregado no equivale a una tabla ni a todo el grafo del ORM

Podríamos almacenar el pago y sus reservas en varias tablas y mantener una frontera de decisión. También podríamos guardar responsabilidades diferentes en una tabla sin que deban formar un único agregado. La pregunta es qué debe comprobarse conjuntamente y por qué.

Una entidad puede ser raíz de un agregado, pero identidad y frontera de consistencia no son sinónimos. Un ID permite seguir un pago; la raíz añade responsabilidad sobre las reservas que lo modifican. No necesitamos una clase base `AggregateRoot` para expresar ese comportamiento.

Si cada reserva comprobara solo su importe contra el total original, aceptaría 70 y 40 por separado. Separar objetos no conserva automáticamente una regla que necesita el acumulado. Incluir cliente, dirección y todos sus pedidos, en cambio, cargaría datos que esta decisión no necesita.

## Una función pura también puede proteger esta regla

Elegimos clases para enseñar encapsulación y distinguir identidad de valor. Una función que reciba un estado inmutable, lo valide y devuelva una decisión puede cumplir el mismo objetivo. DDD no obliga a heredar de `BaseEntity` ni a introducir una interfaz para cada clase.

Tampoco necesitamos un **domain service** para este cálculo: la regla pertenece al pago y sus reservas. Sería razonable extraer una política si una decisión no encajara en ninguna entidad o valor sin forzar sus responsabilidades. Sacar todos los métodos a un servicio por defecto dejaría el modelo como una bolsa de datos.

En el extremo contrario, guardar miles de reservas en el mismo agregado aumentaría el coste de cargarlo. Para este fixture el conjunto es pequeño. En un sistema real habría que revisar límites, representación y coordinación, no cargar un historial ilimitado por fidelidad al ejemplo.

## Garantías y límites: encapsular no serializa solicitudes

La regla se cumple al aplicar operaciones sucesivas sobre el estado devuelto. Eso no impide que dos tareas carguen el mismo estado inicial y construyan decisiones válidas por separado.

Tampoco son garantías de seguridad frente a código hostil: TypeScript elimina modificadores como `private` al ejecutarse y no valida objetos externos por arte de magia. Los campos `#` sí ocultan el estado interno, pero la frontera de entrada sigue necesitando validación. El modelo no verifica que la captura exista en un proveedor ni controla quién puede solicitarla.

No implementamos cancelación de reservas, conversión monetaria o reenvío idempotente: un ID repetido se rechaza. El [contrato de idempotencia](/posts/idempotencia-api-claves-efectos) exige decisiones adicionales si queremos devolver el resultado anterior ante un retry.

## Ejercicio: una nueva regla sin romper el límite

Limita cada solicitud a 80 euros, manteniendo el máximo acumulado del pago. Una solicitud de 90 debe fallar sobre un pago de 200; dos solicitudes de 70 deben poder aceptarse sobre ese mismo pago. Añade además una prueba que confirme que el original no cambia tras el rechazo.

Seguimos con [domain services](/posts/domain-services-politicas-negocio): no toda regla pertenece al agregado de pagos. La ventana temporal de una devolución tiene otra responsabilidad.

## Referencias

- [Martin Fowler: Value Object](https://martinfowler.com/bliki/ValueObject.html).
- [Vaughn Vernon: Effective Aggregate Design, parte I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf).
- [TypeScript: strict y su alcance](https://www.typescriptlang.org/tsconfig/strict.html).
- [PostgreSQL: constraints e integridad persistida](https://www.postgresql.org/docs/18/ddl-constraints.html).

Fuentes consultadas el 20 de octubre de 2026. Ejemplo ejecutado con Node 24.19.0 y comprobado con TypeScript 5.9.2. No se ha medido rendimiento del modelo.
