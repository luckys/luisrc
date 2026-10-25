---
id: "AWS-CHOICE"
title: "Una API en Lambda o ECS: comparar costes sin inventar rendimiento"
published: "2026-10-25T14:10:00Z"
locale: "es"
translationKey: "aws-foundations-aws-choice"
slug: "api-lambda-ecs-costes-supuestos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-DYNAMODB", "AWS-ECS"]
description: "Cómo comparar los dos diseños, sus partidas y sus tareas operativas con supuestos verificables. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La primera estimación compara invocaciones Lambda con dos tasks de Fargate. Falta la entrada HTTP, el load balancer y la salida de red. La hoja da números, pero todavía no representa ninguna de las dos arquitecturas que queremos operar.

Cerramos esta serie con una comparación reproducible de **Lambda y ECS**, usando el catálogo de los artículos anteriores. Separaremos tarifas verificables, entradas asumidas, pruebas locales y trabajo operativo. Una cifra precisa puede seguir siendo una mala respuesta si no sabemos qué incluye.

## Antes del precio, fija qué servicio estás comparando

El diseño A es **API Gateway HTTP API → Lambda Event Functions on-demand x86 → DynamoDB**, sin adjuntar la función a una VPC del cliente. El diseño B es **ALB público → ECS Fargate Linux/x86 con tasks privadas en dos AZ → DynamoDB**.

El segundo utiliza tres servicios con interface endpoints en cada AZ: ECR API, ECR Docker y CloudWatch Logs. Son seis interfaces, además de gateway endpoints para S3 y DynamoDB. No necesita llamadas a internet externo y no incluye NAT. También asumimos dos IPv4 públicas del ALB; no es un máximo garantizado de direcciones en cualquier carga.

Ambos diseños proponen la misma lectura de catálogo. No hemos probado que dos tasks de cierto tamaño soporten el mismo tráfico que la configuración Lambda. **La comparación de capacidad sigue abierta**.

<img src="/assets/visuals/aws-foundations/AWS-CHOICE.svg" alt="La comparación combina entradas declaradas con tarifas archivadas y calcula subtotales de Lambda con HTTP API y ECS con ALB y red. Quedan fuera DB, logs y trabajo; capacidad y operación siguen por validar." width="319" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-CHOICE.svg).

## Las tarifas tienen región, unidad y tramo

El snapshot se descargó el **25 de octubre de 2026**, de catálogos públicos **AWS Price List**, en **us-east-1** y USD. Se archivan producto, SKU, dimensión, unidad, rango y fecha, además de la URL y el hash del catálogo descargado.

Usamos tarifas on-demand, sin free tier, créditos, compromisos, Spot o impuestos. Las partidas Lambda y HTTP API pertenecen a su primer tramo de volumen. El modelo rechaza entradas fuera de los tramos y shapes implementados en vez de aplicarles silenciosamente la misma tarifa.

Estos son los factores usados, no una promesa de precios futuros:

<div role="region" aria-label="Tarifas archivadas del modelo AWS" tabindex="0" style="overflow-x:auto">

| Partida | Tarifa USD | Unidad |
| --- | --- | --- |
| Lambda requests | 0,0000002 | petición |
| Lambda x86 | 0,0000166667 | GB-s |
| HTTP API | 0,000001 | petición en el tamaño modelado |
| Fargate CPU | 0,04048 | vCPU-hora |
| Fargate memoria | 0,004445 | GB-hora |
| ALB | 0,0225 | hora |
| ALB capacidad | 0,008 | LCU-hora |
| Interface endpoint | 0,01 | servicio × AZ × hora |
| Datos de interface endpoint | 0,01 | GB del primer tramo |
| IPv4 pública | 0,005 | dirección-hora |

</div>

La **LCU** agrega dimensiones de utilización del ALB, como conexiones y bytes procesados. Aquí es una entrada asumida; no la deducimos de las peticiones mensuales. El payload se limita en el modelo a 512 KiB para no extender la tarifa HTTP API como si todos los tamaños contasen igual.

## El compute Lambda combina memoria y tiempo facturado

Este extracto de `src/costs.ts` mantiene visibles las unidades:

```typescript
  const gbSeconds = input.requests * (input.memoryMb / 1024) * (input.billedMs / 1000)
  const lambdaLines = {
    requests: amount(input.requests * rates.lambdaRequest),
    compute: amount(gbSeconds * rates.lambdaGbSecond),
    httpApi: amount(input.requests * rates.httpApiRequest),
  }
```

Un millón de invocaciones a 512 MB y 100 ms facturados produce 50.000 GB-s. Con las tarifas archivadas: **0,20 USD** por peticiones Lambda, **0,833335 USD** de compute y **1 USD** de HTTP API. El subtotal es **2,033335 USD**.

Los 100 ms son una hipótesis, no una duración medida. El modelo conserva ocho decimales para reproducir sus cálculos; esa precisión interna no describe cómo AWS redondearía una factura real.

## El subtotal ECS conserva partidas aunque el tráfico baje

Para dos tasks de 0,25 vCPU y 0,5 GB durante 730 horas, el compute suma **18,02005 USD**. Añadimos **16,425 USD** de ALB-hora, **0,584 USD** por 0,1 LCU asumida, **43,8 USD** de interfaces endpoint, **0,2 USD** por 20 GB procesados en ellas y **7,3 USD** por dos IPv4 públicas.

El subtotal resulta **86,32905 USD**. Omitir endpoints por parecer infraestructura auxiliar escondería la partida más grande de este escenario. Tampoco sería válido sustituirlos por una NAT gratuita imaginaria.

No significa que cualquier API ECS cueste eso. Son dos tasks siempre presentes, una topología concreta y entradas declaradas. Un diseño público diferente, otra política de escalado o una salida externa cambiarían las partidas y las responsabilidades.

## Dos escenarios muestran sensibilidad, no capacidad equivalente

<div role="region" aria-label="Subtotales calculados para dos escenarios AWS" tabindex="0" style="overflow-x:auto">

| Escenario declarado | Lambda + HTTP API | ECS + ALB + red |
| --- | --- | --- |
| 1 millón de peticiones; tasks 0,25 vCPU/0,5 GB | 2,033335 USD | 86,32905 USD |
| 100 millones; tasks 1 vCPU/2 GB | 203,3335 USD | 163,9652 USD |

</div>

En el segundo supuesto mantenemos Lambda a 512 MB/100 ms, pero aumentamos la shape de las dos tasks, LCU a 4 y datos de endpoints a 100 GB. **No es una curva de autoscaling observada**. Elegir esas entradas no demuestra que las tasks mayores puedan atender los picos ni que Lambda conserve aquella duración.

<img src="/assets/interactive/aws-foundations/cost-summary.svg" alt="Dos escenarios declarados comparan subtotales parciales en USD de Lambda con HTTP API y ECS con ALB y red. Las shapes ECS cambian entre escenarios; la capacidad equivalente no está probada." width="380" height="480" loading="lazy" style="width:100%;height:auto" />

[Ampliar el gráfico](/assets/interactive/aws-foundations/cost-summary.svg).

El comparador reutiliza el mismo modelo compilado que los tests. Cambia peticiones, memoria o duración y observa las partidas. Si aumentas peticiones sin aumentar tasks, el subtotal ECS apenas cambia en ese cálculo; eso **no demuestra que la capacidad alcance**. Las LCU y los GB de red permanecen como entradas explícitas.

<iframe src="/assets/interactive/aws-foundations/explorer.html" title="Comparador de subtotales AWS con supuestos editables" loading="lazy" width="100%" height="1800" style="border:0;border-radius:12px"></iframe>

[Abrir el comparador](/assets/interactive/aws-foundations/explorer.html).

## El trabajo operativo también cambia la decisión

<div role="region" aria-label="Responsabilidades operativas de los dos diseños" tabindex="0" style="overflow-x:auto">

| Decisión | Lambda del diseño A | ECS/Fargate del diseño B |
| --- | --- | --- |
| Ejecución | Runtime, timeout, concurrencia y evento | Image, task definition, salud y reemplazo |
| Escala | Cuotas, throttling, duración y dependencia | Tasks, recursos, targets y política de escalado |
| Red | Integración HTTP y acceso a DynamoDB | ALB, subnets, grupos, DNS y endpoints |
| Recuperación | Versión, permisos y tratamiento de errores | Revisión, compatibilidad y tráfico entre tasks |
| Datos | Modelo, autorización y validación | Modelo, autorización y validación |

</div>

No asignamos horas ficticias a esas tareas. Para justificar el coste operacional necesitamos conocer automatización existente, experiencia del equipo, guardias y tiempo de respuesta requerido. Una adaptación a Lambda puede reducir gestión de procesos y añadir trabajo en eventos o límites. Fargate puede aprovechar una image ya operada y mantener más configuración de servicio y red.

La decisión razonable queda condicionada: si la carga encaja en el modelo de función y tolera su latencia, merece evaluar el diseño A. Si exige un proceso persistente o una integración ya resuelta con containers, tiene sentido evaluar B. Después hay que validar capacidad y operación, no declarar un ganador con esta tabla.

## Código completo y pruebas

Consulta [fuentes y comandos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/README.md), [tarifas originales seleccionadas](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/pricing/catalogue-excerpts.json) y [captura](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/evidence/comparison.json). Tras `git clone https://github.com/luckys/luisrc-blog-examples.git`:

```bash
pnpm install --frozen-lockfile
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
pnpm --dir packages/aws-foundations verify
```

## Garantías y límites

Los tests comprueban fórmulas, unidades, entradas rechazadas y contratos locales. Se excluyen DB, almacenamiento, logs, transferencias, workloads S3/SQS, impuestos, descuentos y horas de ingeniería. No hay factura, benchmark AWS, capacidad equivalente o TCO comprobado. El hash verifica consistencia del snapshot; no es una attestation firmada por AWS.

## Ejercicio: convertir una estimación en una decisión revisable

Elige un escenario y registra qué medirías antes de contratar capacidad: distribución temporal de tráfico, duración, tamaño de respuesta, saturación de DB, LCU y comportamiento ante fallos. Anota qué dato podría hacerte cambiar de diseño. Esa lista será la entrada para profundizar en infraestructura declarativa y, después, capacidad y costes.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026. El repositorio conserva los rate codes concretos usados:

- [AWS Price List: catálogo regional de Lambda](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-east-1/index.json).
- [Precios de Lambda](https://aws.amazon.com/lambda/pricing/) y [HTTP API](https://aws.amazon.com/api-gateway/pricing/).
- [Precios de Fargate](https://aws.amazon.com/fargate/pricing/).
- [ALB y dimensiones de LCU](https://aws.amazon.com/elasticloadbalancing/pricing/).
- [PrivateLink](https://aws.amazon.com/privatelink/pricing/) e [IPv4 pública](https://aws.amazon.com/vpc/pricing/).
