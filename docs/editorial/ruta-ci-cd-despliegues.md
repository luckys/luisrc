# CI/CD: entregar cambios y conservar una vuelta atrás

P063 se divide en ocho drafts españoles. Ninguno depende de un producto concreto.
OPS-DELIVERY conserva su visión de conjunto; DB-MIGRATIONS sigue siendo la base
para compatibilidad de datos. Código completo en packages/progressive-delivery,
con extractos explicados en los posts.

## Orden de lectura

1. **CI/CD y gates**: qué comprueba cada etapa y qué detiene la entrega.
2. **Artefactos inmutables**: identificación y promoción del contenido probado.
3. **Feature flags**: deploy, release y vuelta del comportamiento.
4. **Smoke tests**: contrato mínimo sobre una versión ya desplegada.
5. **Rolling**: convivencia y sustitución de instancias por pasos.
6. **Blue-green**: preparar otro grupo y cambiar tráfico.
7. **Canary**: exposición parcial, control, muestras y decisión.
8. **Rollback**: recuperar la aplicación sin destruir datos o contrato antiguo.

Smoke precede a estrategias porque primero necesitamos saber qué resultado hace
que un paso se acepte o se detenga. Cada estrategia merece un artículo: comparte
controles, pero cambia la forma de exponer riesgo y la capacidad que requiere.

## Laboratorio que conecta los conceptos

Catálogo ficticio con precios en céntimos. Dos images fijan su configuración de
release durante el build; candidato intencionalmente defectuoso si se activa una
flag. PostgreSQL compartido, dos slots de API y un grupo green. Router local por
HTTP con control privado IPC, sin Kubernetes ni servicio remoto de flags.

Pipeline local con tests, tipos, build, audit real de dependencias runtime y
política de image. No se presenta como una ejecución remota de GitHub Actions.
El candidato se marca explícitamente como fixture negativo, sin promoción real.

Se exige evidencia de convivencia rolling, conmutación, canary sintético con
control, retirada, flag off con misma image y rollback a image anterior. Ambas
versiones deben conservar lecturas/escrituras en esquema expandido; ensayo de
contract destructivo dentro de una transacción que se revierte.

Diagramas por concepto, gráfica de fallos de negocio frente a HTTP y visor del
recorrido archivado. Separar observaciones locales de disponibilidad continua,
significancia estadística, pipeline remoto, scan del sistema operativo o producción.

Después P064–P066: cloud, infraestructura y capacidad/costes. El inventario del
roadmap no equivale a la aceptación de todas sus fichas.
