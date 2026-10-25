---
id: "CAP-COMMITMENTS"
title: "Reservas y compromisos: pagar menos por hora no siempre reduce el gasto"
published: "2026-10-25T17:05:00Z"
locale: "es"
translationKey: "capacity-costs-cap-commitments"
slug: "reservas-compromisos-descuentos-capacidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["CAP-ESTIMATES"]
description: "Cómo separar capacidad reservada de descuento y detectar compromisos ociosos. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

Un descuento del 30% parece una mejora inmediata. Pero si obliga a pagar seis unidades todo el mes y el servicio usa dos casi todo el tiempo, la tarifa menor puede producir una factura mayor.

Después de [los tres presupuestos](/posts/estimar-costes-servicio-tres-escenarios), separaremos dos decisiones: disponer de capacidad cuando haga falta y comprometer gasto a cambio de una tarifa. Calcularemos horas ociosas pagadas y comprobaremos por qué no conviene comprar compromisos a partir del pico.

## Reservations puede referirse a cosas distintas

En una conversación técnica, «reservar» puede significar reservar sitio para un Pod, contratar capacidad física o adquirir un beneficio de facturación. No son intercambiables.

En AWS, **Savings Plans** implica un compromiso monetario por hora para uso elegible. [No reserva capacidad EC2](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-ris.html). La contratación y las condiciones del descuento pertenecen a la facturación; siguen existiendo límites de ejecución y disponibilidad de recursos.

Una **On-Demand Capacity Reservation** reserva capacidad de EC2 en una Availability Zone bajo atributos definidos. Sus condiciones dependen, entre otras cosas, de si es inmediata o futura, como explica la [documentación](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html). No equivale a un descuento automático.

Las **Reserved Instances** regionales y zonales también difieren: la [tabla oficial](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/reserved-instances-scope.html) distingue las regionales sin reserva de capacidad de las zonales que sí la incluyen en la zona especificada. Hay que leer producto y alcance, no deducir garantías del nombre.

<img src="/assets/visuals/capacity-costs/CAP-COMMITMENTS.svg" alt="Cómo separar capacidad reservada de descuento y detectar compromisos ociosos. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="263" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-COMMITMENTS.svg).

## Un contrato ficticio permite entender la utilización del compromiso

Para aislar la cuenta, el laboratorio usa un contrato inventado de **unidades de réplica por hora**. Cada unidad comprometida cuesta 0,042 USD/h, se use o no; el exceso cuesta 0,06 USD/h. Lo que no se utiliza en una hora no se acumula para la siguiente.

Este contrato **no reproduce Savings Plans**, que expresa el compromiso monetariamente, ni una oferta de Reserved Instances. Tampoco acredita capacidad física. Es una forma de ver el coste de comprometer más base de la que se consume.

Con el perfil estable, dos réplicas durante 720 horas consumen 1440 horas-réplica. On-demand supone **86,40 USD de compute**. Comprometer dos unidades al precio ficticio reducido cuesta **60,48 USD**.

Comprometer seis cuesta **181,44 USD**, aunque solo se usen dos. Hay **2880 horas-unidad ociosas pagadas**. El descuento por unidad no compensa comprar tres veces la base necesaria.

## El exceso se paga aparte y la ociosidad también cuenta

En `packages/capacity-costs/src/model.ts`, `commitment` valida las entradas y recorre cada franja. Este es el cálculo del coste dentro del bucle:

```typescript
    cost +=
      BigInt(hours) *
      (BigInt(units) * rate + BigInt(Math.max(0, replicas - units)) * od);
```

`units × rate` se paga en todas las horas del compromiso. `replicas - units`, cuando es positivo, representa uso adicional a tarifa on-demand. El archivo completo devuelve también horas cubiertas, ociosas y de exceso para que el total tenga explicación.

En campaña, comprometer la base de dos unidades produce 60,48 USD por la base más 7,20 USD por 120 horas-réplica adicionales: **67,68 USD de compute**. Comprometer las seis unidades del pico vuelve a costar 181,44 USD. No estamos sumando esos costes al subtotal original; sustituyen su partida compute bajo el contrato hipotético.

## El punto de equilibrio depende de qué estás comparando

Para una unidad adicional bajo este contrato, si usarla on-demand costaría `0,06 × horas de uso` y comprometerla cuesta `0,042 × todas las horas`, necesita uso superior al **70%** del periodo para resultar más barata. Al 70% empatan.

Es una deducción de esas dos tarifas fijas y de la ausencia de otros beneficios. No es un umbral universal para Savings Plans. Otros contratos tienen reglas de elegibilidad, plazos, pagos iniciales o aplicación a cargas distintas.

Además, comparar contra infraestructura sobredimensionada puede fabricar ahorros. Antes de negociar una tarifa menor conviene revisar qué uso seguirá siendo necesario después de rightsizing, cambios de arquitectura o retirada de entornos.

## Comprar descuento también compra riesgo de previsión

Una base estable, compatible con el producto y razonablemente previsible puede justificar compromiso. Un pico breve o un servicio a punto de migrar exige otra evaluación.

Las alternativas incluyen mantener flexibilidad on-demand, comprometer solo una base conservadora o repartir decisiones a medida que se dispone de evidencia. **Spot** introduce otra dimensión, la posibilidad de interrupción y la compatibilidad de la carga con ella; no debe compararse solo por precio por hora.

La capacidad para una campaña conocida se puede preparar antes del pico sin comprometer todo el año el máximo. Son dos decisiones separadas. La [capability de Rate Optimization de FinOps Foundation](https://www.finops.org/framework/capabilities/rate-optimization/) sitúa la elección de descuentos dentro de una estrategia de uso y riesgo, no como sustituto de ella.

## Código completo y pruebas

El código de laboratorio vive en el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git). Consulta el [modelo y validaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/src/model.ts), las [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/tests/model.test.mjs) y las [entradas de los escenarios](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/scenarios.json). No requiere credenciales ni servicios de pago.

Desde la raíz del monorepo, con Node.js 24.19.0 y pnpm 12.8.1:

```bash
pnpm --dir packages/capacity-costs test
pnpm --dir packages/capacity-costs exercise
pnpm --dir packages/capacity-costs verify
pnpm --dir packages/capacity-costs render
```

## Tests, garantías y límites

El laboratorio comprueba el caso útil de dos unidades, el exceso de seis y las horas ociosas. Mantiene dinero entero en microUSD. No compra contratos, consulta recomendaciones comerciales ni modela amortización contable o todas las reglas de un proveedor.

El ahorro de compute calculado no acredita menor TCO. Una migración para aprovechar un contrato también puede consumir horas de equipo o cambiar el riesgo operativo.

## Ejercicio: rechazar una compra mal justificada

Te proponen comprometer seis unidades porque campaña llega a seis réplicas. Usa las franjas del perfil para calcular horas utilizadas y ociosas. Redacta qué evidencia exigirías sobre la base estable antes de comprometer gasto. Terminaremos la serie definiendo cómo revisar esas decisiones con coste, uso y resultados del servicio.

Continúa con [FinOps: convertir el coste por petición en una decisión que puedas revisar](/posts/finops-coste-peticion-asignacion-presupuesto).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Savings Plans y RIs, AWS](https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-ris.html).
- [Capacity Reservations, AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-reservations.html).
- [RIs regionales y zonales, AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/reserved-instances-scope.html).
- [Rate Optimization, FinOps Foundation](https://www.finops.org/framework/capabilities/rate-optimization/).
