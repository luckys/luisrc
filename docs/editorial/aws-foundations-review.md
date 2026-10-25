# Revisión de AWS: servicios, responsabilidades y costes

P064 se desarrolla en once drafts españoles, separados por concepto. Ver
[ruta](ruta-aws-fundamentos.md) y [manifiesto](aws-foundations-series.json).
Autor Luis Ramírez Calle. No se publican, traducen ni generan audios.

## Cobertura de la ficha del roadmap

| Requisito | Artículo / laboratorio | Evidencia y alcance |
| --- | --- | --- |
| IaaS/PaaS/serverless | P064 | Fronteras de responsabilidad, Region/AZ y dos diseños para la misma lectura |
| IAM | AWS-IAM; catalogueReadPolicy | Política GetItem con ARN de tabla, wildcard rechazado. Sin evaluación IAM real |
| VPC | AWS-VPC; ecs.json/preflight | Rutas, grupos, DNS, ALB, endpoints; inventario declarado, no conectividad observada |
| EC2 | AWS-EC2; http.ts | Máquina/proceso/disco/operación, HTTP loopback real. Sin instancia lanzada |
| Lambda | AWS-LAMBDA; catalogue.ts | Adaptador payload v2 local, concurrencia y duración facturada; sin AWS benchmark |
| ECS | AWS-ECS; task-fragment.json | Task definition/task/service/Fargate y recursos. Cuenta y digest ficticios, no desplegable |
| S3 | AWS-S3; documentKey | Keys validadas; presigned URL explicada como capacidad temporal reutilizable. Sin objeto creado |
| SQS | AWS-SQS; processStandardBatch/queue plan | Fallo parcial b entre a/b/c; recomendación de visibilidad separada del mínimo AWS. Sin entrega SQS |
| Managed DB | AWS-RDS; reviewManagedDb | Multi-AZ/replicas/backups/RPO/RTO, no se acepta un booleano como prueba de restore |
| DynamoDB | AWS-DYNAMODB; catalogueGetItemInput | Entrada GetItem por key y ConsistentRead, sin Scan ni consulta AWS real |
| Cost models y comparación operacional | AWS-CHOICE; costs.ts/pricing/designs | Dos subtotales reproducibles, matriz de trabajo propio, exclusiones y capacidad pendiente |

Se cumple la comparación de diseños que pide la ficha sin crear recursos cloud.
No se sustituye por dos tarifas de compute aisladas: están descritas las entradas,
la red y las tareas operativas. No hay horas de ingeniería inventadas ni una
conclusión de rendimiento a partir de un precio.

## Fuentes canónicas y ejemplos

Código en `luisrc-blog-examples/packages/aws-foundations`. Los posts incluyen nueve
extractos TypeScript y una task definition JSON completa; los diez coinciden con
las fuentes probadas. Once índices por post enlazan esas fuentes en GitHub. Los
IDs de carpetas están en inglés. El blog conserva solo SVG, visor, modelo puro
compilado e informe público, según allowlist de cinco archivos.

No hay nuevas dependencias ni cambio de package.json, workspace o lockfile raíz.
El renderer se ejecuta desde el directorio del laboratorio. No usa el control
plane de AWS, credenciales, datos privados o recursos facturables. La actualización
explícita de precios descarga cinco catálogos públicos AWS Price List.

## Evidencia local y tarifas

Captura final `2026-10-25T12:10:51.810Z`, veinticinco hashes, cuatro casos HTTP
loopback reales:200/404/405/503, contrastados con el adaptador Lambda invocado
como función local. Reader ficticio; servidor `127.0.0.1:35375` cerrado al acabar.
No es una medición de latencia de Lambda ni una integración con DynamoDB.

Durante la revisión se añadió una aserción para Allow:GET en405. Falló primero
(null frente a GET); se corrigieron ambos adaptadores mediante un helper de
cabeceras compartido y los tests pasaron. Los snippets se actualizaron y exercise
se repitió para preservar hashes actuales. Verify contrasta también el informe
público completo con su subconjunto esperado, no solo casos seleccionados.

Tarifas capturadas `2026-10-25T11:33:36.124Z`: AWSLambda, AmazonApiGateway,
AmazonECS, AWSELB y AmazonVPC, diez dimensiones us-east-1/USD. Se conservan SKU,
rate code, unidad, tramo, fechas de publicación/vigencia y URL versionada, junto
con SHA del catálogo recibido. Los hashes acreditan consistencia del snapshot,
no una firma o attestation de AWS.

Lambda del diseño: HTTP API y Event Functions on-demand x86 sin VPC del cliente.
ECS: Fargate Linux/x86, ALB público y tasks privadas en dos AZ, tres servicios
interface endpoint por AZ más gateway S3/DynamoDB, sin NAT o internet externo.
Dos IPv4 públicas son una hipótesis, no límite garantizado del ALB.

Subtotales del escenario de un millón: Lambda2,033335USD/ECS86,32905USD. A cien
millones, con shapes ECS mayores, LCU4 y100GB de endpoints:203,3335/163,9652USD.
La segunda fila cambia entradas, no demuestra autoscaling ni throughput. DB,
logs, almacenamiento, transferencias, workloads S3/SQS, impuestos, descuentos y
horas de ingeniería quedan fuera. No es factura completa, TCO ni capacidad probada.

## Recursos visuales y comprobación

- Once D2/SVG de anchura260–319px y gráfico derivado380×480. Los diagramas con
  ramas demasiado anchas se rediseñaron en secuencias explícitas para móvil;
  se inspeccionaron todos los originales, el gráfico y su presentación en posts.
- Visor oscuro estático: dos escenarios, siete campos editables, barras con escala
  común y desglose de nueve partidas. Cambiar tráfico no recalcula LCU/GB/capacidad;
  el supuesto permanece visible. El nombre elegido se muestra fuera del select
  para leerlo completo en móvil. Usa el mismo modelo compilado de los tests.
- Quince tests de laboratorio y typecheck strict pasan. Exercise y verify pasan.
- Frozen install con pnpm12.8.1 en33proyectos pasa, sin modificar lock ni relajar
  supply-chain. El primer intento offline carecía de metadatos del registro; se
  repitió con acceso al registro y sus467entradas pasaron la política existente.
- 119 checks editoriales/estructurales pasan, seis nuevos de AWS: orden, metadatos,
  fuentes, snippets, datos escritos, dimensiones, unidades, hashes y exports.
- Build50rutas/68HTML, Pagefind10páginas publicadas,4280palabras,dos idiomas.
  Diecinueve tests del blog pasan. Se corrigió la clonación HTTPS de estos drafts
  para cumplir la convención de fuentes; no se relajó el test.
- Índices236, laboratorios32, exports79. El auditor registra68IDs con draft,
  20relacionados y87sin artículo identificado; inventario, no aceptación global.
- Verify P062/P063 sigue pasando con los inputs raíz intactos; no fue necesario
  reiniciar Docker por cambios exclusivos de documentos, visores y fuentes AWS.

La suite Chromium comprueba los once posts y visor en1440/360px:24vistas, enlaces
internos y assets, noindex, ausencia de overflow global y errores JavaScript.
Verifica ambos escenarios, siete campos, valores exactos, barras/desglose, cero
tráfico, tres entradas inválidas, reset y teclado. Incluye tablas desplazables,
details y falta del informe, que muestra error en lugar de estimación. Las
capturas se toman tras estabilizar el scroll de teclado; no se ocultan columnas
como arreglo de layout. Informe final: `/tmp/aws-foundations-layout.1fPYA0/report.json`.
Servidor QA468571 detenido; puertos4322 y35375 comprobados sin listener al terminar.

## Límites que siguen abiertos

No despliegue AWS, IAM efectivo, DNS/grupos/rutas probados, pérdida de AZ, cold
starts, capacidad de tasks, coste real, restauración RDS, operación S3, entrega
SQS, DLQ/redrive o idempotencia durable. Los preflights no emulan esos servicios.
No hay ganador general derivado del subtotal. La comparación debe ampliarse con
carga y evidencia operativa antes de elegir una arquitectura de producción.

P065 continúa con Terraform/Kubernetes y un despliegue mínimo local verificable.
P066 profundizará dimensionamiento y costes con escenarios propios. Conservar
los gaps P026, Stripe sandboxP045 y soak prolongadoP058. Serie02 mantiene el
alcance de estructuras de datos y algoritmos. El objetivo global sigue activo.
