---
id: "AWS-LAMBDA"
title: "Lambda: ejecutar por eventos con concurrencia, límites y tiempo facturado"
published: "2026-10-25T14:04:00Z"
locale: "es"
translationKey: "aws-foundations-aws-lambda"
slug: "aws-lambda-eventos-concurrencia-limites"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-EC2"]
description: "Cómo cambia el contrato al adaptar una API a Lambda Event Functions on-demand. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La API recibe pocas peticiones durante horas y una ráfaga al publicarse un catálogo. Mantener un proceso encendido es una forma de atenderlas, pero no la única. **Lambda** permite entregar un handler y que la plataforma gestione los entornos que lo ejecutan.

Venimos de [EC2 y el proceso HTTP](/posts/aws-ec2-maquina-virtual-operacion). Aquí analizamos **Lambda Event Functions on-demand**, el modelo concreto usado en la comparación. Otras modalidades de Lambda pueden tener reglas distintas de ejecución, concurrencia y precio; no trasladaremos estas conclusiones a todas ellas.

## El handler recibe un evento y devuelve un resultado

En el diseño propuesto, **API Gateway HTTP API** recibe HTTP y envía un evento a Lambda. El handler no abre el puerto público de nuestra API: interpreta el evento y devuelve la respuesta con la forma que espera la integración.

El adaptador de `src/catalogue.ts` recibe un reader y reutiliza la lógica del catálogo:

```typescript
export function lambdaAdapter(read: Reader) {
  return async (event: { rawPath: string; requestContext: { http: { method: string } } }) => {
    const result = await catalogueRequest(event.requestContext.http.method, event.rawPath, read)
    return { statusCode: result.statusCode, headers: catalogueHeaders(result.statusCode), body: JSON.stringify(result.body), isBase64Encoded: false }
  }
}
```

El ejemplo usa el subconjunto necesario de un evento **payload v2**: ruta y método. Devuelve status, cabeceras, body serializado e indicación de que no está codificado en base64. El helper `catalogueHeaders`, definido en el mismo módulo, añade `Allow: GET` a las respuestas `405`. Serializar importa: el body de esta respuesta es una cadena JSON, no el objeto de dominio directamente.

No estamos acoplando la búsqueda de producto a API Gateway. La función compartida decide `200`, `404`, `405` o `503`; el adaptador transforma el contrato de entrada y salida. Si la dependencia falla, mantener `503` evita presentar una indisponibilidad como si el producto no existiese.

El test invoca este handler como una función local y compara su resultado con HTTP loopback. No verifica un mapping desplegado, autorización de API Gateway, cabeceras completas o cuotas del servicio.

## Concurrencia es trabajo en curso, no peticiones del mes

En este modelo Event Functions, cada petición concurrente ocupa un entorno de ejecución separado. Cuando ese entorno termina puede reutilizarse para una petición posterior. El estado en memoria de un entorno no es una sesión compartida ni persistencia fiable.

Como aproximación para una carga estable:

`concurrencia media ≈ peticiones por segundo × duración media en segundos`

Si llegan 100 peticiones por segundo y duran 0,2 segundos, la media sería unas 20 invocaciones en curso. No es un máximo garantizado: las ráfagas, la variabilidad y los límites de escalado pueden exigir otra capacidad. Un millón de peticiones mensuales no permite deducir el pico.

<img src="/assets/visuals/aws-foundations/AWS-LAMBDA.svg" alt="HTTP API entrega un evento al adaptador Lambda, que llama a la lógica compartida y devuelve cuatro resultados posibles. La concurrencia depende de peticiones por segundo y duración, no del total mensual." width="276" height="1072" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-LAMBDA.svg).

La **reserved concurrency** reserva una parte del cupo y limita la concurrencia de esa función. No mantiene entornos precalentados. La **provisioned concurrency** prepara capacidad inicializada y tiene su propio coste. Las cuotas dependen de cuenta y región; deben revisarse antes de usar un valor de documentación como capacidad disponible.

Limitar concurrencia puede proteger una base de datos, aunque también puede provocar throttling. El cliente necesita un comportamiento definido ante ello. En una integración HTTP síncrona no debemos asumir que Lambda reintentará el trabajo del mismo modo que un event source de cola.

## Un cold start tiene una causa distinta a una consulta lenta

Antes de invocar el handler en un entorno nuevo hay inicialización de runtime y código. Esa preparación puede contribuir a la latencia del usuario. Reutilizar clientes fuera del handler puede reducir trabajo repetido, pero hay que tolerar conexiones caducadas y reinicios del entorno.

El **timeout** limita cuánto puede durar una ejecución. La memoria configurada también influye en la CPU disponible. Aumentarla puede cambiar el tiempo y el coste; no podemos conocer el resultado sin medir la aplicación.

La comparación usa **512 MB y 100 ms facturados** como hipótesis, no como medición obtenida invocando la función en este portátil. Los GB-s del escenario se calculan así:

`1.000.000 × (512 / 1024) × (100 / 1000) = 50.000 GB-s`

Multiplicamos esos GB-s por la tarifa archivada y añadimos peticiones Lambda y HTTP API. La duración de entrada debe reflejar lo realmente facturado para el caso que se evalúe, incluidos los componentes de inicialización aplicables. No sustituimos esa medición por la latencia de una dependencia aislada.

## No conectamos Lambda a nuestra VPC sin una necesidad

El catálogo propuesto consulta DynamoDB y no necesita un recurso privado de la VPC del cliente. El diseño no adjunta la función a esa VPC. Una aplicación que necesite RDS privado tendría que revisar red, conexiones y coste.

Una función por petición puede multiplicar conexiones si cada ejecución abre una conexión SQL. Serverless no convierte el límite de la DB en infinito. La elección de persistencia y sus patrones de acceso sigue formando parte del diseño.

## Código completo y pruebas

El [adaptador Lambda](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/src/catalogue.ts), los tests y la captura están en el monorepo. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git`:

```bash
pnpm install --frozen-lockfile
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

El informe etiqueta esas invocaciones `local_adapter_only_not_AWS` para que no se confundan con resultados de Lambda.

## Garantías y límites

El handler conserva cuatro respuestas del contrato local. No hay cold starts, throughput, concurrencia, latencia o factura AWS observados. El modelo excluye provisioned concurrency y otras modalidades de Lambda, además de free tier, descuentos y partidas indicadas en la comparación.

## Ejercicio: una dependencia empieza a tardar el triple

Mantén 100 peticiones por segundo y cambia la duración media de 0,2 a 0,6 segundos. Calcula la concurrencia aproximada. Explica por qué reservar capacidad no arregla esa dependencia ni demuestra que soporte más solicitudes. Continúa con [ECS Fargate](/posts/aws-ecs-fargate-tasks-servicios), donde dimensionamos tasks mantenidas en ejecución.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Concurrencia de Event Functions](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html).
- [Memoria de Lambda y CPU](https://docs.aws.amazon.com/lambda/latest/dg/configuration-memory.html).
- [Integración HTTP API con Lambda](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).
- [Precios y modelos de Lambda](https://aws.amazon.com/lambda/pricing/).
