---
id: "CAP-FINOPS"
title: "FinOps: convertir el coste por petición en una decisión que puedas revisar"
published: "2026-10-25T17:06:00Z"
locale: "es"
translationKey: "capacity-costs-cap-finops"
slug: "finops-coste-peticion-asignacion-presupuesto"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["CAP-COMMITMENTS"]
description: "Cómo definir denominadores, asignar costes compartidos y reconciliar una estimación. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

El gasto mensual baja, pero también lo hace la cantidad de operaciones útiles que completa el servicio. Celebrar solo la reducción de la factura puede ocultar una pérdida de eficiencia o una degradación del producto.

Después de [reservas y compromisos](/posts/reservas-compromisos-descuentos-capacidad), cerraremos el circuito: definir una unidad útil, asignar costes compartidos sin perder dinero en redondeos y revisar una estimación cuando cambian sus supuestos.

## Cost per request necesita un denominador definido

**Cost/req** divide el coste de un alcance y periodo por una cantidad de peticiones del mismo alcance y periodo. Hay que decir si contamos ofrecidas, admitidas, completadas o buenas según el SLI.

Con el perfil estable, el subtotal parcial es **159,516715 USD** y hay 20 736 000 peticiones ofrecidas. El coste calculado por millón ofrecidas es **7,692743 USD**, redondeado hacia arriba al microUSD.

El escenario supone un **99,9% de peticiones buenas**, no observado. Su denominador es 20 715 264 y el coste por millón buenas sube a **7,700444 USD**. La diferencia es pequeña aquí; con muchos errores puede crecer mucho.

Si no hay ninguna petición buena, la razón no se define. El visor muestra ese caso explícitamente, en lugar de devolver cero e insinuar un servicio gratuito. Estas cifras tampoco son el coste marginal de una petición adicional: el numerador incluye partidas fijas y escalones de capacidad.

## Una petición técnica y una operación de negocio pueden diferir

Una búsqueda útil puede hacer varias llamadas HTTP. Una operación reintentada puede aumentar peticiones sin crear más valor. Medir solo coste por HTTP puede premiar una fragmentación del API o esconder trabajo duplicado.

Conviene conservar la métrica técnica para diagnosticar recursos y definir otra ligada al resultado: coste por pedido completado, informe generado o búsqueda útil. La definición necesita un contador fiable, deduplicación y reglas de elegibilidad.

**Unit Economics**, según [FinOps Foundation](https://www.finops.org/framework/capabilities/unit-economics/), vincula métricas de uso y coste con el valor de la actividad. No obliga a que toda decisión se resuma en una única razón. Un SLO, una obligación de seguridad o una capacidad de recuperación siguen teniendo que cumplirse.

<img src="/assets/visuals/capacity-costs/CAP-FINOPS.svg" alt="Cómo definir denominadores, asignar costes compartidos y reconciliar una estimación. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="270" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-FINOPS.svg).

## La asignación de costes debe reconciliar el total

Una base compartida de plataforma no tiene una atribución natural por petición. Podemos usar consumo medido, capacidad reservada o una regla acordada. La regla debe responder a una decisión concreta y ser visible para los equipos.

El ejercicio reparte el subtotal con pesos ficticios **5:3:2** entre catálogo, búsqueda y plataforma. No afirma que esa sea su causalidad real. Primero calcula participaciones enteras por truncamiento y después asigna los microUSD restantes a los mayores restos, con desempate estable por orden.

En `packages/capacity-costs/src/model.ts`:

```typescript
export function allocate(total: string, weights: number[]) {
  const amount = money(total);
  if (!weights.length || weights.length > 100) throw Error("invalid_weights");
  for (const w of weights) bounded(w, 0, 1000000000, true);
  const denominator = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (!denominator) throw Error("positive_total_weight_required");
  const shares = weights.map((w) => (amount * BigInt(w)) / denominator);
  const order = weights
    .map((w, i) => ({ i, remainder: (amount * BigInt(w)) % denominator }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const remaining = amount - shares.reduce((a, b) => a + b, 0n);
  for (let i = 0; i < Number(remaining); i++) shares[order[i].i] += 1n;
  return shares.map(String);
}
```

`money` valida una string de microUSD enteros y `bounded` limita los pesos. Con 100 microUSD y pesos 2:1, devuelve 67 y 33. La suma conserva los 100. Ningún equipo recibe un float y no aparece una diferencia que alguien tenga que «ajustar a mano».

Este algoritmo resuelve reconciliación aritmética, no justicia de la regla de reparto. Para evitar disputas, la política de allocation necesita dueño, fecha y explicación de qué representa cada peso.

## Estimar, presupuestar y observar son actividades distintas

Una **estimate** es una cuenta bajo hipótesis. Un **budget** expresa cuánto se autoriza gastar. Un **forecast** se revisa con nueva evidencia. El coste observado necesita datos de facturación y sus reglas de devengo; el laboratorio no dispone de ellos.

Si el tamaño de respuesta de campaña sube de 10 000 a 100 000 bytes, el subtotal pasa de 279,478662 a **898,666613 USD** sin cambiar RPS. Una revisión útil separaría efecto de volumen, precio, mezcla de operaciones, tamaño de datos y capacidad ociosa.

Si el gasto supera el presupuesto, apagar réplicas puede violar el objetivo de disponibilidad. En cambio, eliminar una salida duplicada o retirar un entorno sin uso podría reducirlo sin cambiar el servicio esperado. Hay que comprobar el efecto, no suponerlo.

La [Usage Optimization de FinOps Foundation](https://www.finops.org/framework/capabilities/usage-optimization/) relaciona uso de recursos con necesidades y resultados. Optimizar tarifa y optimizar consumo son palancas diferentes. En este laboratorio se pueden estudiar sin contratar infraestructura.

## Una revisión pequeña y repetible resulta más útil que una captura aislada

Para el catálogo del portafolio guardaría una ficha con periodo, moneda, servicio, propietario, SLO, entradas de demanda, precios, exclusiones y versión de cálculo. Después contrastaría lo estimado con consumo y coste observados del mismo periodo.

Ante una desviación, registraría una hipótesis y una intervención verificable: reducir payload, cambiar una consulta o retirar capacidad ociosa. Tras el cambio repetiría medidas de errores, latencia y coste por unidad útil. Comparar solo el total antes/después sería insuficiente si cambió mucho la demanda.

No hace falta empezar con una plataforma de chargeback. Un informe reproducible con datos buenos y responsables claros puede servir mejor que una herramienta compleja alimentada por denominadores incompatibles. Las [guías de Planning & Estimating](https://www.finops.org/framework/capabilities/planning-estimating/) ofrecen un marco para organizar supuestos y revisión.

## Código completo y pruebas

El código de laboratorio vive en el [repositorio de ejemplos](https://github.com/luckys/luisrc-blog-examples.git). Consulta el [modelo y validaciones](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/src/model.ts), las [pruebas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/tests/model.test.mjs) y las [entradas de los escenarios](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/capacity-costs/scenarios.json). No requiere credenciales ni servicios de pago.

Desde la raíz del monorepo, con Node.js 24.19.0 y pnpm 12.8.1:

```bash
pnpm --dir packages/capacity-costs test
pnpm --dir packages/capacity-costs exercise
pnpm --dir packages/capacity-costs verify
pnpm --dir packages/capacity-costs render
```

## Garantías y límites

La evidencia de esta serie contiene tres presupuestos, sensibilidades y trazas calculadas. Los tests recalculan las partidas y la asignación conserva cada microUSD. No hay factura contrastada, forecast validado, ahorro realizado ni capacidad cloud certificada.

Los importes siguen excluyendo partidas declaradas. Cambiar el denominador no convierte un subtotal en TCO ni demuestra rentabilidad de negocio.

## Ejercicio: escribir una decisión revisable

Elige un perfil y define una unidad útil que no pueda inflarse con reintentos. Escribe numerador, denominador, periodo, exclusiones y responsable. Propón una mejora, qué coste esperas cambiar y qué métricas impedirían aceptarla si empeora el servicio. Guarda la ficha junto con las entradas para que otra persona pueda recalcular tu decisión.

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Unit Economics, FinOps Foundation](https://www.finops.org/framework/capabilities/unit-economics/).
- [Usage Optimization, FinOps Foundation](https://www.finops.org/framework/capabilities/usage-optimization/).
- [Planning & Estimating, FinOps Foundation](https://www.finops.org/framework/capabilities/planning-estimating/).
