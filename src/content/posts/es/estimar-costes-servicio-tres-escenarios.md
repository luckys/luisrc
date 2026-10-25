---
id: "CAP-ESTIMATES"
title: "Estimar costes: tres perfiles de tráfico y un presupuesto que muestra sus supuestos"
published: "2026-10-25T17:04:00Z"
locale: "es"
translationKey: "capacity-costs-cap-estimates"
slug: "estimar-costes-servicio-tres-escenarios"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["CAP-AUTOSCALING"]
description: "Cómo calcular partidas, comparar pico permanente y ajuste ideal, y hacer análisis de sensibilidad. Cálculos reproducibles, supuestos explícitos y límites."
author: "Luis Ramírez Calle"
series: "Capacidad y costes: de la demanda a un presupuesto defendible"
tags: ["capacity-planning", "finops", "backend", "costes"]
---

Dos servicios procesan casi el mismo volumen mensual, pero uno recibe tráfico repartido y el otro concentra gran parte en una hora diaria. Presupuestarlos solo por «peticiones al mes» puede ocultar cuánta capacidad necesitan al mismo tiempo.

Vamos a construir una estimación de **treinta días**, con tres perfiles, partidas visibles y análisis de sensibilidad. El resultado será un subtotal condicionado por supuestos. No es una oferta de proveedor ni el coste total de operar el servicio.

## Los tres perfiles declaran horas y RPS

Todos repiten el mismo día treinta veces. CPU por petición: 10 ms. Cada réplica aporta un core, el target es 60%, hay una réplica de margen, mínimo dos y máximo ocho. La dependencia tiene un techo supuesto de 800 RPS.

<div role="region" aria-label="Tres perfiles diarios de tráfico hipotético" tabindex="0" style="overflow-x:auto">

| Perfil | Día declarado | Peticiones en 30 días |
| --- | --- | --- |
| Estable | 8 RPS durante 24 h | 20 736 000 |
| Horario concentrado | 10 RPS durante 16 h y 120 durante 8 h | 120 960 000 |
| Campaña | 20 RPS durante 23 h y 300 durante 1 h | 82 080 000 |

</div>

Son entradas hipotéticas, no una previsión de demanda validada. Multiplicamos cada tasa por los segundos de su franja y sumamos. La media mensual de campaña oculta el pico de 300 RPS que sí determina el número de réplicas.

## Las tarifas son ficticias para poder revisar las cuentas

El archivo `packages/capacity-costs/scenarios.json` declara moneda **USD** y unidad interna **microUSD**, una millonésima de dólar:

```json
{
  "replicaHour": "60000",
  "fixedMonth": "30000000",
  "requestMillion": "1000000",
  "storageGiBMonth": "100000",
  "egressGiB": "90000"
}
```

Ese fragmento equivale a 0,06 USD por hora-réplica, 30 USD de base fija mensual, 1 USD por millón de peticiones, 0,10 USD por GiB-mes y 0,09 USD por GiB de salida. **Ninguna de esas cifras es una tarifa AWS consultada**. Para precios de proveedor, el artículo de [Lambda y ECS](/posts/api-lambda-ecs-costes-supuestos) conserva su propio snapshot y alcance.

Añadimos 50 GiB almacenados y 10 000 bytes de respuesta por petición. Un GiB son 1 073 741 824 bytes. Suponemos que toda petición ofrecida genera ese volumen de salida a efectos del presupuesto; no reutilizamos los rechazos de la simulación para inventar una factura.

## Separar unidades evita errores de dinero y de tiempo

Las peticiones y horas son enteros en estas entradas. El dinero se calcula con `BigInt` y se serializa como strings. Cada partida fraccionaria se redondea hacia arriba al microUSD, una política didáctica visible que no pretende reproducir el redondeo de un proveedor.

En `packages/capacity-costs/src/model.ts`, estas son las partidas dentro de `estimate`:

```typescript
  const lines = {
    compute: (BigInt(replicaHours) * r.replicaHour).toString(),
    fixed: r.fixedMonth.toString(),
    requests: ceilRatio(
      BigInt(requests) * r.requestMillion,
      1000000n,
    ).toString(),
    storage: (BigInt(p.storageGiB) * r.storageGiBMonth).toString(),
    egress: ceilRatio(
      BigInt(requests) * BigInt(p.bytesPerRequest) * r.egressGiB,
      1073741824n,
    ).toString(),
  };
```

`ceilRatio` hace la división entera con redondeo hacia arriba. No multiplicamos dólares de coma flotante y después intentamos arreglarlos con `toFixed`. Los números de la tabla siguiente se muestran con seis decimales para permitir reconciliación con los datos; la gráfica redondea solo su presentación a céntimos.

## Ajuste ideal por franjas y pico permanente son políticas diferentes

Con los supuestos CPU necesitamos dos réplicas en carga baja, tres en la franja de 120 RPS y seis en la de 300. El ajuste ideal suma **1440, 1680 y 1560 horas-réplica**, respectivamente.

Mantener todo el mes el máximo de cada perfil consume 1440, 2160 y 4320 horas-réplica. Para campaña, compute pasa de 93,60 USD en el ajuste ideal a 259,20 USD con pico permanente.

El ajuste ideal **supone disponibilidad instantánea al comienzo de cada franja**, sin costes de arranque o solapamiento. La [simulación de autoscaling](/posts/autoscaling-colas-arranque-picos) mostró por qué eso no describe automáticamente un despliegue reactivo. No integramos esa traza de cinco minutos en las horas mensuales.

<img src="/assets/visuals/capacity-costs/CAP-ESTIMATES.svg" alt="Cómo calcular partidas, comparar pico permanente y ajuste ideal, y hacer análisis de sensibilidad. El diagrama separa entradas, cálculo y límites para evitar interpretar una estimación hipotética como capacidad medida o factura real." width="281" height="845" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/capacity-costs/CAP-ESTIMATES.svg).

<div role="region" aria-label="Partidas calculadas por escenario en USD" tabindex="0" style="overflow-x:auto">

| Partida | Estable | Horario | Campaña |
| --- | --- | --- | --- |
| Compute | 86,400000 | 100,800000 | 93,600000 |
| Base fija | 30,000000 | 30,000000 | 30,000000 |
| Peticiones | 20,736000 | 120,960000 | 82,080000 |
| Storage | 5,000000 | 5,000000 | 5,000000 |
| Egress | 17,380715 | 101,387501 | 68,798662 |
| **Subtotal parcial** | **159,516715** | **358,147501** | **279,478662** |

</div>

<img src="/assets/interactive/capacity-costs/cost-scenarios.svg" alt="Subtotales parciales de tres perfiles calculados con tarifas ficticias. Se comparan réplicas ideales por franja y pico permanente; DB, operación y otras partidas permanecen excluidas en ambas alternativas." width="380" height="425" loading="lazy" style="width:100%;height:auto" />

[Ampliar el gráfico](/assets/interactive/capacity-costs/cost-scenarios.svg).

## Contrastar supuestos es más útil que dar muchos decimales

Si multiplicamos por diez el tamaño de respuesta de campaña, el subtotal calculado pasa a **898,666613 USD**. La partida variable de salida cambia aunque mantengamos los mismos RPS y réplicas.

Duplicar CPU por petición hace que el pico de campaña necesite once réplicas, por encima del máximo de ocho. El modelo conserva un subtotal de los recursos permitidos, pero lo marca **inviable** para esa política. No se puede recomendar esa cifra como presupuesto de un servicio que atenderá toda la demanda.

Prueba esos cambios en el visor. El control de CPU modifica el presupuesto; la simulación inferior conserva sus 10 ms CPU por petición y tiene sus propios controles de preparación y dependencia.

<iframe src="/assets/interactive/capacity-costs/explorer.html" title="Explorar tres presupuestos, concurrencia y autoscaling simulado" loading="lazy" width="100%" height="2200" style="border:0;border-radius:12px"></iframe>

[Abrir el comparador](/assets/interactive/capacity-costs/explorer.html).

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

Los cálculos se recalculan desde entradas archivadas y se reconcilian partida a partida. Excluimos DB, balanceador, logs, backups, impuestos, ingeniería, transferencias entre zonas y solapamientos. Es un **subtotal**, no TCO, factura ni validación de capacidad o latencia. Los 50 GiB son un stock supuesto para ese mes, no un modelo de crecimiento de datos.

## Ejercicio: pedir el dato que falta

Elige campaña y redacta qué medirías antes de aprobar presupuesto: CPU real por operación, tamaño de respuesta, distribución temporal, consumo de DB y preparación. Identifica también las tarifas y partidas que faltan. La siguiente entrega analiza cuándo un descuento por compromiso puede empeorar el gasto.

Continúa con [Reservas y compromisos: pagar menos por hora no siempre reduce el gasto](/posts/reservas-compromisos-descuentos-capacidad).

## Referencias

Fuentes primarias consultadas el 25 de octubre de 2026. Los cálculos y tarifas ficticias son propios del laboratorio. Las capabilities citadas pertenecen a FinOps Foundation.

- [Planning & Estimating, FinOps Foundation](https://www.finops.org/framework/capabilities/planning-estimating/).
