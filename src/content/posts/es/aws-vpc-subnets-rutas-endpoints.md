---
id: "AWS-VPC"
title: "VPC, subnets y endpoints: dibujar por dónde puede salir una petición"
published: "2026-10-25T14:02:00Z"
locale: "es"
translationKey: "aws-foundations-aws-vpc"
slug: "aws-vpc-subnets-rutas-endpoints"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-IAM", "P005"]
description: "Qué hacen rutas, direcciones, security groups y endpoints en una API privada. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La task tiene permiso para leer el catálogo, pero ni siquiera llega a arrancar: no puede descargar su image. El problema ocurre antes de que la aplicación ejecute una consulta. Una política IAM correcta no sustituye un camino de red.

Tras [IAM](/posts/aws-iam-roles-politicas-permisos), vamos a seguir las conexiones que necesita una API privada en **ECS Fargate**. La pregunta práctica es qué destino necesita cada componente y por dónde puede alcanzarlo.

## Una VPC contiene subnets, no una protección automática

Una **VPC** delimita una red virtual. En ella elegimos rangos de direcciones y creamos **subnets** asociadas a una AZ. La **route table** de cada subnet determina el siguiente destino para un rango IP.

Una subnet se considera pública cuando tiene una ruta hacia un **internet gateway**. Para que una instancia acceda a internet mediante IPv4 por ese camino también necesita dirección pública y reglas que permitan el tráfico. Llamar «pública» a la subnet no publica automáticamente todos sus procesos.

Una subnet privada carece de esa salida directa. Puede tener conectividad hacia otros servicios por rutas internas, endpoints o una salida diseñada expresamente. «Privada» no significa desconectada ni garantiza que la aplicación esté bien aislada.

Los **security groups** regulan el tráfico permitido en las interfaces a las que se aplican y mantienen estado de las conexiones. Las rutas responden por dónde ir; los grupos responden qué tráfico aceptar. IAM sigue decidiendo qué operaciones de AWS están autorizadas.

## El ALB puede ser público y las tasks privadas

El diseño propone un **Application Load Balancer**, o **ALB**, en subnets públicas de dos AZ. Recibe la petición del cliente y abre una conexión hacia una task privada. Esa segunda conexión no requiere una IP pública en la task.

El security group de la task debería aceptar el puerto de la API desde el grupo del ALB, en vez de permitirlo desde cualquier origen. La regla debe acompañarse de healthchecks, targets correctos y capacidad de las tasks. No hemos creado esos recursos; estamos describiendo el camino que habrá que verificar.

Una caída puede estar en la entrada pública, la conexión ALB-task o la salida task-dependencia. Probar solo que un puerto responde desde tu portátil no cubre los tres recorridos.

<img src="/assets/visuals/aws-foundations/AWS-VPC.svg" alt="El cliente alcanza un ALB público que dirige la API hacia tasks privadas. Descargar la image, enviar logs y consultar datos requieren endpoints, DNS, rutas, security groups y permisos compatibles." width="286" height="1072" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-VPC.svg).

## Descargar una image y escribir logs también necesita red

Nuestra API solo consulta DynamoDB, pero arrancarla requiere más servicios. Usamos una image privada en **ECR** y el driver **awslogs** de CloudWatch. En un diseño sin NAT declaramos interfaces endpoint para `ecr.api`, `ecr.dkr` y `logs`, además de gateway endpoints para S3 y DynamoDB. ECR utiliza S3 para descargar layers.

Las tasks Fargate no necesitan los interface endpoints de ECS para este caso; no hay que confundir el plano de gestión de ECS con cada dependencia usada por la task. La [documentación de endpoints de ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/vpc-endpoints.html) explica esas diferencias.

El preflight del laboratorio comprueba que no omitimos dependencias declaradas:

```typescript
export function validatePrivateEcsNetwork(plan: { zones: number; publicTaskIp: boolean; services: string[]; gateways: string[]; externalInternetRequired: boolean }) {
  if (plan.zones !== 2 || plan.publicTaskIp || plan.externalInternetRequired) throw Error('outside_private_design')
  for (const service of ['ecr.api', 'ecr.dkr', 'logs']) if (!plan.services.includes(service)) throw Error(`missing_endpoint:${service}`)
  for (const gateway of ['s3', 'dynamodb']) if (!plan.gateways.includes(gateway)) throw Error(`missing_gateway:${gateway}`)
  return true
}
```

Dos AZ y tres servicios de interfaces dan **seis interfaces endpoint** en este diseño. Las gateway endpoints de S3 y DynamoDB no añaden el mismo cargo por hora de interface endpoint. Más adelante incluiremos sus partidas al comparar costes.

Esta función solo revisa un documento. Que las cadenas estén presentes no demuestra resolución DNS, rutas correctas o reglas de security group. Una prueba real tendría que descargar la image, enviar logs y consultar DynamoDB desde el entorno privado.

## Sin NAT encaja porque no llamamos a internet externo

Podríamos diseñar una salida IPv4 mediante **NAT Gateway**. Tendría sus propias rutas, disponibilidad y cargos. Aquí escogemos endpoints porque los destinos necesarios son servicios AWS compatibles y no hay una llamada a una API externa.

Si mañana el catálogo consulta un proveedor de internet, el supuesto cambia. El preflight rechaza `externalInternetRequired: true` para obligarnos a revisar esa decisión. Añadir el booleano no crea conectividad, y sumar una NAT sin revisar rutas tampoco demuestra que funcione.

Los endpoints restringen caminos, pero no sustituyen la autorización. Sus políticas, DNS privado, grupos y políticas IAM requieren una revisión conjunta. Un permiso amplio detrás de un endpoint sigue siendo un permiso amplio.

## Código completo y pruebas

El [diseño de red](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/ecs.json) y los [tests negativos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/tests/contracts.test.mjs) están en el monorepo. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` y `pnpm install --frozen-lockfile`:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

El test retira `logs` y exige un error. Esa regresión demuestra que el preflight detecta una omisión; no que CloudWatch haya recibido logs.

## Garantías y límites

La topología está declarada para dos AZ, sin NAT y sin IP pública en las tasks. No hay VPC desplegada ni prueba de conectividad, DNS, pérdida de AZ o endpoints efectivos. Las seis interfaces son un supuesto de arquitectura que se factura en el modelo, no un inventario observado.

## Ejercicio: añadir una dependencia externa

Dibuja la conexión hacia una API de terceros. Indica ruta, DNS, salida, permisos y partida de coste nueva. Después explica qué prueba demostraría conectividad y cuál demostraría que los destinos innecesarios siguen bloqueados. Continúa con [EC2 y la operación de una máquina](/posts/aws-ec2-maquina-virtual-operacion).

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Opciones de routing en VPC](https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html).
- [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html).
- [Endpoints y Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/vpc-endpoints.html).
- [ECR y VPC endpoints](https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html).
