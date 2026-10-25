---
id: "AWS-ECS"
title: "ECS con Fargate: gestionar tasks sin administrar los hosts"
published: "2026-10-25T14:05:00Z"
locale: "es"
translationKey: "aws-foundations-aws-ecs"
slug: "aws-ecs-fargate-tasks-servicios"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-LAMBDA", "P063"]
description: "Cómo distinguir task definition, task, service y responsabilidades de una image. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La image funciona con Docker y queremos ejecutarla en AWS sin administrar las máquinas que la alojan. **ECS con Fargate** encaja en esa necesidad, pero subir una image no define todavía un servicio disponible.

Después de [Lambda](/posts/aws-lambda-eventos-concurrencia-limites), retomamos un proceso de API que escucha HTTP. La unidad que escalamos será una **task**, con CPU, memoria, red y una o varias definiciones de container.

## Task definition, task y service no son sinónimos

Una **task definition** describe cómo ejecutar la aplicación: image, recursos, puertos, roles, logs y otras opciones. Sus revisiones permiten identificar configuraciones distintas.

Una **task** es una ejecución de esa definición. Un **ECS service** mantiene un número deseado de tasks y gestiona su sustitución según la configuración del servicio. Arrancar una task aislada para un trabajo puntual no crea el mismo compromiso de mantener una API atendiendo tráfico.

**Fargate** aporta la capacidad de ejecución sin que administremos sus hosts. ECS también puede utilizar otras opciones de capacidad. Elegimos Fargate en este diseño para comparar responsabilidades concretas; «usar ECS» por sí solo no indica quién mantiene las máquinas.

Si falla una task y el servicio lanza otra, la reposición necesita tiempo y recursos disponibles. La aplicación debe tolerar esa sustitución. Guardar sesiones o archivos únicos en el container haría que un reemplazo correcto desde el punto de vista de ECS pudiera perder estado relevante.

<img src="/assets/visuals/aws-foundations/AWS-ECS.svg" alt="Una task definition describe la ejecución y ECS service mantiene las tasks deseadas sobre Fargate. El ALB dirige tráfico a targets saludables; el equipo conserva image, red, capacidad y recuperación." width="294" height="1088" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-ECS.svg).

## Una task definition necesita más que la image

El [fragmento del laboratorio](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/task-fragment.json) declara `awsvpc`, Fargate, Linux/x86, 0,25 vCPU y 512 MB. Identifica la image por digest y separa **task role** de **execution role**.

Este es el documento completo del ejemplo. Los identificadores y el digest son ficticios; lo usamos para revisar la configuración, sin registrarlo ni ejecutarlo en AWS:

```json
{
  "family": "catalogue-example",
  "requiresCompatibilities": [
    "FARGATE"
  ],
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "runtimePlatform": {
    "cpuArchitecture": "X86_64",
    "operatingSystemFamily": "LINUX"
  },
  "taskRoleArn": "arn:aws:iam::000000000000:role/catalogue-reader",
  "executionRoleArn": "arn:aws:iam::000000000000:role/catalogue-execution",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "000000000000.dkr.ecr.us-east-1.amazonaws.com/catalogue@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "user": "node",
      "readonlyRootFilesystem": true,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/example/catalogue",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

Las combinaciones de CPU y memoria tienen restricciones; no elegimos cualquier pareja porque su multiplicación dé un precio pequeño. El modelo local acepta únicamente un subconjunto explícito de shapes válidos y rechaza el resto.

La image debe contener un usuario compatible con `user: node`. El filesystem de solo lectura obliga a identificar qué necesita escribir la aplicación. Es una decisión de ejecución que hay que probar con esa image, no una bandera que garantice seguridad completa.

El fragmento incluye `awslogs`. Para que funcione hacen falta destino, permisos y conectividad. Sus ARN de cuenta y digest son ficticios: el documento ilustra decisiones, no se presenta como una definición lista para registrar y desplegar.

## El ALB dirige peticiones; el service mantiene tasks

Proponemos dos tasks privadas distribuidas entre dos AZ y un ALB público. El load balancer necesita targets saludables, puerto correcto y reglas de red. El service necesita una estrategia de despliegue y capacidad para reemplazar tasks.

Un **healthcheck** debería indicar cuándo una task puede recibir tráfico. Conviene distinguir el proceso vivo de la capacidad de atender una operación. A la vez, un check demasiado dependiente de un fallo compartido puede sacar todos los targets del servicio. Hay que decidir qué significa «saludable» para ese caso.

Para desplegar una versión nueva revisamos cuánto solapamiento permitimos entre versiones y qué ocurre con conexiones en curso. Las decisiones de [rolling y compatibilidad](/posts/rolling-deployments-versiones-compatibilidad) siguen siendo necesarias aunque el scheduler ejecute el reemplazo.

Dos tasks en dos AZ no prueban capacidad durante una caída. Si cada task solo soporta la mitad de la carga normal, perder una puede saturar la otra antes de que arranque un reemplazo.

## Se paga capacidad mantenida, aunque no haya peticiones

En el escenario de tráfico intermitente suponemos dos tasks de 0,25 vCPU y 0,5 GB durante 730 horas. Su compute se calcula con las tarifas de vCPU-hora y GB-hora:

`2 × 730 × (0,25 × 0,04048 + 0,5 × 0,004445) = 18,02005 USD`

Ese valor no incluye ALB, LCU, interfaces endpoint, IPv4, DB o logs. En la [comparación completa del subtotal](/posts/api-lambda-ecs-costes-supuestos), las partidas de red cambian mucho la cifra.

Fargate factura según las reglas de duración y recursos de cada modalidad. Aquí asumimos tasks presentes todo el mes; no simulamos un autoscaler, intervalos de arranque ni coste por cada reemplazo. Tampoco suponemos que dos tasks pequeñas soporten un millón de peticiones con una latencia concreta.

Delegar hosts reduce una parte del trabajo. Quedan image y dependencias, permisos, configuración del servicio, capacidad, observabilidad, releases y recuperación. Una vulnerabilidad dentro de la image no se corrige por cambiar EC2 por Fargate.

## Código completo y pruebas

El [modelo de coste](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/src/costs.ts) y el diseño se prueban localmente. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` e instalar con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
pnpm --dir packages/aws-foundations verify
```

Los tests rechazan una shape no admitida y comprueban que aumentar tasks aumenta el compute. No ejecutan un scheduler de ECS.

## Garantías y límites

Hay un diseño, un fragmento ilustrativo y cálculos reproducibles. No hay tasks desplegadas, image publicada, healthchecks AWS observados o pérdida de AZ ensayada. El precio de compute es una partida, no el coste total de operar la API.

## Ejercicio: desplegar sin duplicar capacidad por accidente

Con dos tasks deseadas, dibuja cuántas podrían coexistir durante una actualización y qué pasaría si una no supera el healthcheck. Define qué limitaría el despliegue y cómo comprobarías el rollback. Continúa con [S3](/posts/aws-s3-objetos-keys-acceso) para sacar documentos del ciclo de vida de esas tasks.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Task definitions, tasks y services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html).
- [Task definition parameters de Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html).
- [Precios de Fargate](https://aws.amazon.com/fargate/pricing/).
- [Task execution role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html).
