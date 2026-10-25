---
id: "AWS-S3"
title: "S3: guardar objetos y controlar su acceso sin tratarlo como un disco"
published: "2026-10-25T14:06:00Z"
locale: "es"
translationKey: "aws-foundations-aws-s3"
slug: "aws-s3-objetos-keys-acceso"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["AWS-ECS", "AWS-IAM"]
description: "Cómo diseñar keys, permisos y acceso temporal para objetos. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

Un usuario sube un documento y la API lo guarda dentro del container. La siguiente actualización reemplaza la task y el archivo desaparece. El problema no es cómo copiarlo al container nuevo: es haber unido la vida del documento a la del proceso.

**S3** ofrece almacenamiento de objetos con un ciclo de vida independiente. Después de [ECS Fargate](/posts/aws-ecs-fargate-tasks-servicios), vamos a decidir cómo identificar un documento, quién puede leerlo y qué significa conceder acceso temporal.

## Un objeto se identifica por bucket y key

Un **bucket** organiza objetos. Cada objeto tiene una **key**, su contenido y metadatos. Una key como `tenants/tenant-a/documents/report-1.json` parece una ruta de carpetas, pero en un bucket de propósito general esos separadores forman parte del nombre del objeto.

No hay que trasladar automáticamente las operaciones de un filesystem POSIX. Modificar un documento no equivale a abrir un archivo local, cambiar unos bytes y hacer un rename atómico dentro de un directorio. La aplicación debe diseñar operaciones de objeto y tratar sus respuestas y posibles conflictos.

Aquí hablamos de buckets de propósito general. Otras modalidades de S3 tienen características propias; tampoco todas las storage classes ofrecen las mismas condiciones de acceso y recuperación.

Al elegir S3 para documentos, el catálogo puede guardar una referencia al objeto. Eso separa metadatos de negocio y contenido, pero introduce una coordinación: puede completarse la subida y fallar la escritura de la referencia, o al contrario. Hay que definir estados y limpieza de objetos huérfanos, no asumir una transacción común entre DB y S3.

## Una key predecible facilita operar; no autoriza al cliente

En el laboratorio generamos las keys de forma explícita:

```typescript
export function documentKey(tenantId: string, documentId: string) {
  for (const value of [tenantId, documentId]) if (!/^[a-z0-9-]{1,40}$/.test(value)) throw Error('invalid_identifier')
  return `tenants/${tenantId}/documents/${documentId}.json`
}
```

La función acepta identificadores cortos con caracteres restringidos y obtiene siempre la misma key para la misma pareja. Rechaza, por ejemplo, un identificador con `/` que introduciría prefijos inesperados. Los tests comprueban ambos comportamientos.

Esa validación mantiene una convención de nombres. **No demuestra que un usuario pertenezca a `tenant-a`**. El backend debe obtener o validar el tenant de la identidad autorizada, no confiar en un parámetro que el cliente pueda cambiar.

Tampoco hay versionado de documentos en la función. Reutilizar la pareja produce la misma key; la estrategia debe decidir si permite reemplazo, usa nuevas keys por versión o se apoya en S3 Versioning. Añadir un prefijo no resuelve por sí solo la concurrencia entre dos editores.

<img src="/assets/visuals/aws-foundations/AWS-S3.svg" alt="La API autoriza al usuario antes de resolver la key y emitir acceso temporal al objeto S3. El prefijo no concede permisos y una presigned URL puede reutilizarse mientras permanezca válida." width="280" height="1072" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/AWS-S3.svg).

## Una presigned URL concede una capacidad temporal

Una **presigned URL** firma una operación sobre un objeto usando las credenciales del principal que la genera. Permite, por ejemplo, que el navegador descargue un documento directamente de S3 sin recibir access keys.

Antes de emitirla, la API debe comprobar que ese usuario puede realizar esa operación sobre ese documento. La URL actúa como una credencial para quien la posee. Incluirla en logs, analítica o mensajes públicos puede entregar esa capacidad a otras personas.

La URL está limitada por sus condiciones y su expiración, también por la validez de las credenciales utilizadas. Puede utilizarse más de una vez mientras siga siendo válida; **no es un enlace de un solo uso**. Si necesitas esa propiedad, tendrás que diseñar otro control, no limitarte a firmar una URL.

Dar acceso temporal directo evita que la API transporte todos los bytes, pero reduce su intervención en cada descarga. La duración elegida debe corresponder al uso. Un enlace de larga duración puede ser cómodo y, a la vez, ampliar el periodo de exposición si se comparte.

## Consistencia fuerte no significa transacción entre servicios

En los buckets de propósito general, S3 ofrece consistencia fuerte para lecturas y listados tras escrituras de objetos completadas. No debemos explicar un objeto reciente que falta con el mito genérico de «S3 siempre es eventually consistent».

Esa garantía no crea una transacción con PostgreSQL o DynamoDB. Tampoco valida el contenido de negocio de un JSON subido ni impide que una escritura posterior sustituya otra. Son problemas diferentes.

Una estrategia posible es subir con una key nueva, comprobar el resultado y después publicar la referencia en el catálogo. Hay que definir cómo recuperar o limpiar un fallo en cada paso. La elección depende de si importan más las versiones inmutables, la sobrescritura o el tiempo de visibilidad del documento.

La retención, el versionado y las políticas lifecycle también tienen coste. Retener versiones antiguas puede ayudar a recuperar un borrado, pero no equivale a haber probado la restauración ni a una política de conservación válida para cualquier dato.

## Código completo y pruebas

La [función de keys](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/src/contracts.ts) y sus tests están en el laboratorio compartido. Tras `git clone https://github.com/luckys/luisrc-blog-examples.git` y la instalación con pnpm:

```bash
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
```

La captura conserva `tenants/tenant-a/documents/report-1.json`. Es una key calculada localmente: no se ha subido ese objeto ni firmado una URL.

## Garantías y límites

Se prueba una convención de nombres y su rechazo de entradas inválidas. No hay bucket, política efectiva, descarga, firma de URL o restauración de versiones probados. El modelo de coste Lambda/ECS excluye workloads S3; no convierte el precio de sus endpoints en el precio de almacenar y descargar documentos.

## Ejercicio: dos documentos con el mismo identificador

Dos usuarios autorizados intentan subir una nueva versión a la misma key. Describe qué resultado quieres preservar y cómo detectarías una actualización concurrente. Añade los estados de fallo entre subida y publicación de referencia. Sigue con [SQS](/posts/aws-sqs-visibilidad-reintentos-batches) para separar la petición del trabajo que puede hacerse después.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Objetos, buckets y consistencia de S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html).
- [Presigned URLs y su expiración](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).
- [Versionado de S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html).
