# AWS: elegir servicios y hacer explícitas sus responsabilidades

P064 se planifica en once drafts españoles; todavía no están escritos. El
manifiesto y el laboratorio inicial están preparados, pero faltan los artículos,
diagramas y comparador visual. La amplitud de la ficha exige separar
servicios y decisiones; un artículo único mezclaría permisos, red, ejecución,
persistencia y facturación antes de que el lector comprendiera sus mecanismos.
Todos siguen en draft y son independientes de un producto concreto.

## Orden recomendado

1. **IaaS/PaaS/serverless y responsabilidad**: qué se delega al proveedor.
2. **IAM**: roles, trust y permisos acotados.
3. **VPC**: subnets, rutas, security groups y endpoints.
4. **EC2**: máquina, proceso, almacenamiento y operación.
5. **Lambda**: Event Functions on-demand, contrato de eventos y concurrencia.
6. **ECS/Fargate**: task definitions, servicios, images y hosts gestionados.
7. **S3**: objetos, keys y acceso temporal.
8. **SQS**: visibilidad, reentrega y respuesta parcial Standard.
9. **RDS**: mantenimiento, disponibilidad, backups y restauración.
10. **DynamoDB**: access patterns, claves y consistencia de lectura.
11. **Comparación Lambda/ECS**: subtotal, supuestos y carga operativa.

Las entregas de bases de datos previas siguen siendo prerrequisitos; no se intenta
volver a explicar SQL en el post de RDS. P066 profundizará dimensionamiento, RPS,
utilización, reservas y FinOps. Aquí se comparan dos diseños concretos.

## Laboratorio y alcance de la evidencia

Código en `packages/aws-foundations` del monorepo, con extractos dentro de los
posts. No usa credenciales, llama al control plane de AWS o crea recursos.

- Dos arquitecturas declaradas: HTTP API/Lambda Event Functions sin VPC del
  cliente y ALB/ECS Fargate con tasks privadas en dos AZ. Ambas proponen DynamoDB.
- Catálogos públicos AWS Price List, diez dimensiones de cinco servicios,
  región us-east-1, USD, on-demand Linux/x86, snapshot con SKU/unidad/tramo/fecha.
- Costes **parciales**: compute/requests/ingress/red, sin DB/logs/transfer/taxes,
  créditos/free tier, descuentos o horas de ingeniería. Sin equivalencia de
  rendimiento verificada, por lo que el subtotal no declara un ganador general.
- ECS requiere seis interfaces endpoint (ECR api/dkr y logs en dos AZ), gateway
  S3/DynamoDB y dos IPv4 de ALB asumidas. No necesita internet externo en este
  diseño; añadirlo obliga a revisar la red y sus costes, no a inventar NAT gratis.
- Función de catálogo compartida con HTTP loopback real y adaptador de evento
  Lambda v2 invocado localmente. Reader ficticio, sin DynamoDB real ni benchmark AWS.
- Preflights de keys/permisos/red/batches/DB explícitamente locales. No evalúan
  IAM real, entregan mensajes SQS, escriben S3 o prueban restore de RDS.
- Pendiente: gráfica estática y comparador interactivo reutilizando el mismo modelo compilado.

Actualizar una tarifa exige volver a capturar sus fuentes, regenerar el informe,
gráficas y comparaciones escritas. No se mezclan regiones o tiers para abaratar
artificialmente una opción. El siguiente bloque es P065, Terraform y Kubernetes.
