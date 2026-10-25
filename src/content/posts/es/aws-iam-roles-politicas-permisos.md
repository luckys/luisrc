---
id: "AWS-IAM"
title: "IAM: dar permisos a un servicio sin repartir claves permanentes"
published: "2026-10-25T14:01:00Z"
locale: "es"
translationKey: "aws-foundations-aws-iam"
slug: "aws-iam-roles-politicas-permisos"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P064"]
description: "Cómo separar quién asume un role, qué puede hacer y con qué recursos. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La API solo necesita leer un producto, pero su configuración contiene las claves de un usuario administrador. Si alguien extrae esas claves de una image o un log, el alcance del incidente ya no queda limitado al catálogo.

**IAM** permite dar una identidad a la carga y acotar sus operaciones. Después de [repartir las responsabilidades del servicio](/posts/cloud-iaas-paas-serverless-responsabilidad), necesitamos separar tres preguntas: quién puede utilizar esa identidad, qué acciones permite y sobre qué recursos.

## Un role ofrece una sesión, no una contraseña permanente

Un **IAM role** es una identidad con permisos que puede ser asumida por un principal autorizado. Al asumirlo se obtienen credenciales temporales. No tiene las access keys permanentes de un usuario IAM. Los servicios y SDK compatibles pueden obtener esas credenciales del entorno de ejecución, sin incluirlas en el repositorio.

Temporal no significa inofensivo. Un proceso comprometido puede abusar de los permisos de su sesión mientras sean válidos. La mejora combina evitar secretos permanentes con reducir acciones y recursos disponibles.

La **trust policy** responde quién puede asumir el role. La **permissions policy** responde qué puede hacer esa sesión. Autorizar al servicio ECS a asumirlo no concede por sí mismo acceso a DynamoDB; permitir `GetItem` tampoco indica quién puede adquirir esa identidad.

## Action y Resource deben corresponder a una necesidad

La lectura del catálogo usa **DynamoDB GetItem**. No necesita crear tablas, borrar productos o consultar cualquier tabla de la cuenta. El laboratorio construye esta permissions policy en `src/contracts.ts`:

```typescript
export function catalogueReadPolicy(tableArn: string) {
  if (!/^arn:aws:dynamodb:us-east-1:\d{12}:table\/[a-zA-Z0-9_-]+$/.test(tableArn)) throw Error('table_arn_required')
  return { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: ['dynamodb:GetItem'], Resource: [tableArn] }] }
}
```

El **ARN** identifica el recurso: partición AWS, servicio, región, cuenta y tabla. La validación local acepta únicamente un ARN de tabla del ámbito que hemos definido para el ejercicio. Rechaza `*` y referencias de otro servicio.

La política generada permite una acción concreta sobre esa tabla. Sigue permitiendo leer sus distintos items; no implementa aislamiento por cliente ni restricciones por clave. Si el catálogo fuese multitenant, habría que diseñar esa frontera y comprobarla por separado.

Elegimos una función pequeña porque queremos probar la intención que redactamos, no escribir un evaluador de IAM. El test comprueba que no ampliamos accidentalmente `Action` o `Resource`. Un objeto JSON bien formado todavía puede dar un resultado distinto al esperado al combinarse con otras políticas de una cuenta real.

<img src="/assets/visuals/aws-foundations/AWS-IAM.svg" alt="La trust policy regula quién asume el role. Su sesión solicita GetItem sobre la tabla y AWS evalúa las políticas y límites aplicables; un Allow local aislado no prueba el permiso efectivo." width="285" height="1072" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-IAM.svg).

## Un Allow aislado no describe todos los permisos efectivos

AWS evalúa el contexto y las políticas aplicables. Un **explicit Deny** puede prevalecer sobre un Allow. También pueden intervenir políticas de recurso, **permissions boundaries**, políticas de sesión y controles de **AWS Organizations**, como las **SCP**.

No conviene resumir esa evaluación como «si encuentro Allow, funciona». Una boundary limita permisos; no los concede por sí sola. En una investigación real interesa identificar qué principal y sesión hicieron la petición, qué recurso se solicitó y qué controles se aplicaban.

Antes de ampliar una política por un `AccessDenied`, comprobaría que la aplicación está usando el role esperado. Dar permisos a otro role puede dejar el error intacto y aumentar la superficie de acceso. El [modelo de evaluación de IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html) detalla esas combinaciones.

## En ECS, task role y execution role tienen trabajos distintos

El **task role** proporciona al código de la aplicación sus permisos de AWS. En nuestro caso contendría la lectura del catálogo. El **task execution role** permite al agente realizar tareas necesarias para arrancar y operar el container, como obtener la image privada de ECR y enviar logs con `awslogs`.

Copiar los permisos de ambos a una identidad más amplia dificulta revisar qué puede hacer el código comprometido. La [task definition ilustrativa](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/designs/task-fragment.json) muestra dos ARN distintos. Sus cuentas e image digest son ficticios; no sirve para desplegarla directamente.

Lambda también necesita un execution role para su código. El nombre parecido no convierte todos los execution roles en la misma frontera: hay que mirar quién recibe las credenciales y para qué las usa.

## Código completo y pruebas

Los [tests de contratos](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/tests/contracts.test.mjs) aceptan el ARN concreto y rechazan un wildcard. Clona el repositorio con `git clone https://github.com/luckys/luisrc-blog-examples.git` e instala las dependencias con `pnpm install --frozen-lockfile`. Desde su raíz:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations typecheck
```

Esta prueba protege la política que generamos. Una validación posterior en una cuenta de pruebas debería cubrir tanto una lectura permitida como operaciones y recursos denegados. No hay resultados de esa prueba cloud en este laboratorio.

## Garantías y límites

La función construye una política de lectura acotada; no evalúa IAM real, no crea un role, no comprueba su trust policy y no valida Organizations. Tampoco autoriza usuarios finales de nuestra API: esa es otra frontera. Los logs y permisos de arranque necesarios no están incluidos en este único fragmento de lectura.

## Ejercicio: intentar hacer demasiado

Lista las acciones de lectura, escritura y administración que necesitaría un servicio de catálogo. Marca cuáles usa realmente esta API. Diseña una prueba negativa para borrar un item y otra para leer una tabla ajena. Explica por qué verificar únicamente la lectura correcta dejaría ambas capacidades sin revisar. Sigue con [VPC y rutas](/posts/aws-vpc-subnets-rutas-endpoints): tener permiso no implica poder alcanzar un destino.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [IAM roles y credenciales temporales](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html).
- [Evaluación de políticas](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html).
- [Task IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html).
- [Task execution IAM role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html).
