# Revisión de P022/P023: validación y errores

Nota de lectura: evidencia histórica anterior a la división en cinco entregas de
este bloque. La estructura vigente está en api-series-split-review.md.

18 de octubre de 2026. Dos artículos españoles, draft, autor Luis Ramírez Calle.
Continuación de Serie 03, no finalización de P020–P031. No traducción, publicación,
audio ni push. El commit inicial 3d3de63 guarda el trabajo de turnos anteriores;
estos artículos son cambios posteriores a ese commit.

## Alcance y decisiones contrastadas

- P022 cubre parsing, semántica de entrada, negocio, JSON Schema 2020-12/OpenAPI
  3.1.1, Zod, Pydantic, runtime, optional/null, refinement, errores y compatibilidad.
- P023 cubre errores de negocio/infraestructura/validación, RFC 9457, catálogo
  estable, stock/versión, request ID, logging y seguridad. type es identificador
  primario; code es extensión propia coherente, no sustitución de la norma.
- Dos diagramas D2 verticales y enlace de ampliación. P022 muestra fronteras y
  fallos; P023 muestra éxito, versión obsoleta y falta de stock sin segundo descuento.
- Laboratorio separado para no convertir los ejemplos sin dependencias de P020/21
  en una instalación de librerías nueva. Archivo/runtime/lockfile de dependencias.
- Zod/Ajv instalados exclusivamente con pnpm. Pydantic ya estaba en la imagen
  fijada; ejecutado sin red, lectura solamente, sin root y sin pull automático.
- Tests Node/Python escritos y ejecutados en rojo antes de implementar los módulos.
  Se comparan veinte documentos reales compartidos y extremos Unicode 80/81.
- Un ajuste importante: el contrato admite el entero matemático 2.0. El modo
  estricto de Pydantic recibe una conversión previa acotada a floats integrales,
  sin convertir strings ni bools. Se prueba el resultado, no solo la definición.

## Evidencia de laboratorio

- Node 24.19.0, pnpm 12.8.1, Zod 4.6.7, Ajv 8.20.0.
- Python 3.13.15, Pydantic 2.13.5. Imagen/runtime en el ZIP.
- 13 tests Node y cuatro Python: validadores, salida, stock, versión, dos HTTP
  simultáneos, media type, UTF-8, límites, errores múltiples, log seguro y logger roto.
- HTTP real en loopback, fixture independiente por test y cierre de conexiones.
  Dos peticiones simultáneas exigen estados 200/409 y estado final stock 1/versión 2.
- Se prueban secretos ficticios en valor, nombre desconocido, Authorization, query
  y excepción. No se reflejan en cuerpo/logs. No equivale a una auditoría exhaustiva.
- 503 se provoca con una dependencia inyectada. No se afirma fallo de driver real.
- Tres tests raíz: cuatro posts/metadatos/links/seis fragmentos/SVG; ZIP anterior
  de seis archivos y nuevo ZIP de quince, comparados byte a byte con sus fuentes.
- Regresión conjunta: 108 tests Node aprobados, incluidos 56 de raíz, 28 de
  algoritmos, 11 del laboratorio HTTP anterior y 13 del nuevo. Cuatro tests Python
  adicionales aprobados. No se vuelven a ejecutar aquí los laboratorios Python de ML.
- ZIP extraído en /tmp/api-validation-zip.4lKM6i: instalación pnpm offline usando
  el store existente y copia entre filesystems; los 13 tests pasan independientemente.
  El primer intento offline usó otro store vacío, no fue un fallo del lockfile.
- Chromium real: ocho vistas, cuatro posts por 1440/360, links, noindex, SVG
  decodificados y sin errores de página. Informe /tmp/api-contracts-layout.CLY7i5.
  Tabla de P023 corregida con región desplazable y prueba de flecha derecha;
  sin cambios globales de CSS. Diagramas con menor margen blanco para móvil,
  inspeccionados en capturas dedicadas. La carga lazy se espera por estado real,
  no con una pausa fija ni omitiendo la decodificación.
- Build público correcto: 48 rutas, ocho posts indexados. Los cuatro drafts no
  generan HTML/Markdown ni aparecen en llms.txt. ZIP del build idéntico al verificado.
  Aviso Satori previo de line-height en la tarjeta de Python, ajeno a esta entrega.

## Límites deliberados

Sin persistencia, autenticación, OIDC, autorización, SQL, pagos ni workers múltiples.
El tramo stock/versión es síncrono en un proceso. No hay GET de inventario: el
diagrama de recuperación lo etiqueta como conceptual. No hay If-Match/ETag/412,
idempotency keys, trazas distribuidas, rollback o reintentos automáticos.
El request ID es local y no se acepta ciegamente el del cliente. Los logs mínimos
no sustituyen telemetría protegida con causas redactadas y política de retención.
Pydantic valida entradas, no es otro servidor ni validación de salida Python.
Los tres validadores no generan entre sí una especificación única: sus casos
compartidos detectan divergencias concretas, no equivalencia universal.

## Continuación

La continuación P024/P025 está en api-pagination-evolution-review.md: PostgreSQL
con un millón de filas y evolución/consumidores. La siguiente ficha es P026.
Mantener el alcance independiente de Paysafe, español y draft.
