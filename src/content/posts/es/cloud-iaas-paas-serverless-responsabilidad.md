---
id: "P064"
title: "IaaS, PaaS y serverless: qué trabajo delegas y qué sigue siendo tuyo"
published: "2026-10-25T14:00:00Z"
locale: "es"
translationKey: "aws-foundations-p064"
slug: "cloud-iaas-paas-serverless-responsabilidad"
draft: true
status: "draft"
level: "intermedio"
prerequisites: ["P005", "P062"]
description: "Cómo elegir un nivel de gestión sin confundir cloud con ausencia de operación. Ejemplos, decisiones y límites de un laboratorio verificable."
author: "Luis Ramírez Calle"
series: "AWS: elegir servicios y hacer explícitas sus responsabilidades"
tags: ["aws", "cloud", "arquitectura", "backend"]
---

La API está lista para desplegarse y aparecen tres propuestas: una máquina virtual, un servicio de containers o una función. Las tres pueden ejecutar código. Lo que cambia es quién mantiene cada capa, cómo se obtiene capacidad y qué ocurre cuando algo falla.

Esta serie está pensada para quien ya ha trabajado con una API y [Docker](/posts/docker-images-containers-entorno-reproducible), pero necesita entender las decisiones detrás de los nombres de **AWS**. Usaremos un catálogo ficticio que devuelve un producto por identificador. Mantener el problema pequeño permite comparar servicios sin cambiar de aplicación en cada artículo.

## IaaS, PaaS y serverless describen cuánto gestionas

Con **IaaS**, como una máquina virtual **EC2**, eliges una capacidad y administras el sistema operativo invitado y la aplicación. AWS mantiene la infraestructura física; tu equipo decide cómo instala, actualiza, supervisa y recupera el servicio.

En una **PaaS** delegas más trabajo de plataforma. Entregas una aplicación con un contrato de ejecución y el proveedor se ocupa de parte de su despliegue y operación. No es una frontera universal: conviene mirar qué hace cada producto, porque dos plataformas pueden repartir las responsabilidades de forma distinta.

**Serverless** describe servicios donde no administras los servidores que ejecutan tu carga. En **Lambda**, por ejemplo, trabajas con funciones e invocaciones. Eso no significa que desaparezcan los límites, los servidores o la necesidad de operar la aplicación. **Fargate** también permite ejecutar containers sin mantener sus hosts; su unidad de capacidad y facturación es diferente.

La responsabilidad sobre los datos, la autorización y las decisiones de la aplicación permanece en el equipo. El [modelo de responsabilidad compartida de AWS](https://aws.amazon.com/compliance/shared-responsibility-model/) ayuda a identificar esa frontera. No convierte una configuración insegura en segura por haber elegido un servicio gestionado.

## Región y Availability Zone son decisiones de diseño

Una **Region** agrupa infraestructura de una ubicación geográfica. Dentro hay **Availability Zones**, o **AZ**, separadas para reducir fallos compartidos. Elegir región afecta a la proximidad de usuarios y datos, a requisitos de residencia, disponibilidad de servicios y precios.

Distribuir dos procesos entre dos AZ reduce una dependencia de ubicación. Para afirmar que el servicio resiste la pérdida de una zona también hay que comprobar capacidad restante, rutas, datos y recuperación. Dos casillas en un diagrama no prueban ese comportamiento.

En nuestro ejercicio fijamos **us-east-1**, USD y dos AZ para el diseño ECS. No asumimos que sea la región adecuada para cualquier proyecto. La fijamos para no mezclar tarifas ni comparar arquitecturas que cambian de ubicación sin avisar.

## Una misma lectura permite comparar dos diseños

La API ofrece `GET /catalogue/book-1`. La lógica de lectura se comparte entre un servidor HTTP y un adaptador de evento Lambda. Si el producto existe devuelve `200`; si falta, `404`; un método no permitido devuelve `405`; un fallo de la dependencia produce `503`.

El diseño A propone **API Gateway HTTP API → Lambda → DynamoDB**. El diseño B propone **Application Load Balancer → ECS Fargate → DynamoDB**, con tasks privadas. La persistencia propuesta es la misma para separar la elección de compute de un cambio de base de datos.

<img src="/assets/visuals/aws-foundations/P064.svg" alt="La petición de catálogo puede atenderse con HTTP API y Lambda o con ALB y ECS Fargate. Ambos diseños proponen DynamoDB por clave; la capacidad y la operación deben verificarse por separado." width="284" height="829" loading="lazy" style="width:100%;height:auto" />

[Ampliar el diagrama](/assets/visuals/aws-foundations/P064.svg).

Los diseños son documentos, no despliegues ejecutados. El laboratorio verifica que ambos adaptadores locales conservan los cuatro resultados de la API. No mide tiempos de Lambda, no arranca Fargate y no consulta DynamoDB.

Esta separación permite hacer preguntas distintas: ¿el código conserva el contrato?, ¿la red permite arrancarlo?, ¿cuánta capacidad necesita?, ¿qué partidas se facturan? Aprobar una de ellas no responde automáticamente a las demás.

## El coste operacional incluye trabajo y riesgo

Una máquina virtual exige gestionar su sistema operativo, además del proceso. Fargate elimina la gestión del host, pero conservas la image, sus dependencias, el servicio, la red y su capacidad. Lambda cambia el empaquetado y la ejecución, pero sigues decidiendo timeouts, permisos, concurrencia y tratamiento de errores.

No vamos a inventar una cifra de horas de ingeniería para convertir esa diferencia en dinero. Un equipo con operación EC2 automatizada parte de una situación distinta de otro que tendría que construirla. La comparación debe registrar qué tareas existen, quién las asume y qué evidencia falta.

Por el mismo motivo, una factura menor de compute puede ser una mala compensación si obliga a adaptar un proceso largo a un modelo que no encaja. También puede ocurrir lo contrario: mantener máquinas para una tarea ocasional añade trabajo que no mejora el producto.

## Código completo y pruebas

El [laboratorio AWS foundations](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/aws-foundations/README.md) incluye los dos diseños, tarifas archivadas, escenarios y tests. Para reproducirlo:

```bash
git clone https://github.com/luckys/luisrc-blog-examples.git
cd luisrc-blog-examples
pnpm install --frozen-lockfile
pnpm --dir packages/aws-foundations test
pnpm --dir packages/aws-foundations exercise
pnpm --dir packages/aws-foundations verify
```

`exercise` ejecuta HTTP loopback real y calcula los escenarios. `verify` revisa la captura y sus hashes sin llamar a AWS. La descarga explícita de tarifas usa catálogos públicos; no necesitas credenciales ni crear recursos facturables.

## Garantías y límites

Hay evidencia local de cuatro respuestas equivalentes y un modelo de coste trazable. No hay un despliegue cloud, pruebas de failover o capacidad equivalente demostrada. Las estimaciones son subtotales, no una factura completa ni el **TCO**, el coste total de propiedad.

## Ejercicio: repartir una guardia antes de elegir compute

Escribe quién actuaría si caduca un certificado, se agota una conexión a DB o una versión devuelve precios incorrectos. Repite la lista para EC2, Fargate y Lambda. Marca qué tarea elimina el proveedor y cuál solo cambia de herramienta. Continúa con [IAM y roles](/posts/aws-iam-roles-politicas-permisos) para acotar lo que podrá hacer cada servicio.

## Referencias

Fuentes oficiales consultadas el 25 de octubre de 2026:

- [Responsabilidad compartida en AWS](https://aws.amazon.com/compliance/shared-responsibility-model/).
- [Regiones y zonas de disponibilidad](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html).
- [Task definitions de ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html).
