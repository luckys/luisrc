# Revisión de P024/P025: paginación y evolución

Nota de lectura: evidencia histórica anterior a la división en cinco entregas de
este bloque. La estructura vigente está en api-series-split-review.md.

18 de octubre de 2026. Dos borradores españoles, autor Luis Ramírez Calle, nuevos
después del commit solicitado fb190d4. Sin traducción, audio, publicación o push.
El commit inicial guarda P022/P023 y su laboratorio, no estas entregas posteriores.

## Qué se demuestra

- P024 cubre OFFSET/cursor/keyset, orden total, escrituras, filtros/búsqueda e índices.
  PostgreSQL real, millón de filas y 400.000 elegibles en tenant 1/paid.
- Dos conexiones vivas: INSERT confirmado entre sentencias READ COMMITTED de una
  transacción lectora; distinto backend PID. OFFSET repite 999988, keyset no en
  ese caso. No es una carga aleatoria durante el benchmark.
- REPEATABLE READ conserva la vista dentro de una transacción. Otra prueba mueve
  una fila ya entregada y demuestra que puede reaparecer con keyset.
- Benchmark: calentamiento por estrategia, siete muestras alternadas, cuatro
  profundidades, LIMIT 50. Se archivan 56 planes JSON completos. Ancla conocida,
  coste de localizarla excluido; tmpfs, cachés calientes y sin escrituras durante
  timings. Execution Time SQL instrumentado, no latencia HTTP o SLA.
- scanOutputRows es salida del nodo Index Only Scan, no lecturas físicas o todas
  las visitas internas. Hashes SHA256 vinculan muestras con SQL, código y runtime.
- P025 cubre cambios aditivos/breaking, dos consumidores, versiones, SemVer de SDK,
  OpenAPI, contract tests, deprecación y plan de retirada.
- Cliente v1 tolera label, rechaza money y estado desconocido. Cliente v2 exige
  money. HTTP con fuente controlada y también con PostgreSQL. El modo breaking es
  un fallo de test, no un parámetro público. Ambos importes mantienen unidad EUR.
- Ajv valida schemas extraídos de OpenAPI, no el documento entero como schema.
  Se comprueban referencias/operaciones, no se certifica todo OpenAPI. Una cantidad
  semánticamente incorrecta pasa el schema y la aserción de importe la detecta.
- Deprecation RFC 9745 y Sunset RFC 8594, más Link a una guía local realmente
  servida. Fechas ficticias; no hay usuarios afectados o apagado automático de v1.

## Código y reproducción

Node 24.19.0, pnpm 12.8.1, pg 8.23.1, Ajv 8.20.0. Instalación solo con pnpm,
lockfile propio. PostgreSQL 17.11, imagen local fijada por digest en runtime.json.
Dos CPU, 1536 MiB, tmpfs, loopback, usuario postgres, rootfs read-only y sin
capabilities. El runner crea y elimina exclusivamente su contenedor privado.

Trece tests sin Docker más seis PostgreSQL, diecinueve distintos. Se escribieron
tests en rojo antes de implementar los módulos. `pnpm lab` ejecutado: estado,
planes, inserciones, snapshots, búsqueda SQL, dos representaciones, contratos y
tres casos del modelo. Todas las conexiones y el contenedor se cierran al acabar.

Dos diagramas D2 y gráfica de medianas reales. Tabla verificable desde muestras;
eje logarítmico anunciado para no esconder tiempos pequeños. Tres fragmentos SQL
y dos JS nuevos coinciden con fuentes probadas. Visor oscuro, accesible y sin
dependencias, etiquetado como modelo y no como consulta SQL o medición. La inserción
reproduce los IDs observados; los otros modos son simulaciones.

ZIP por allowlist de 24 archivos, lockfile, planes y README. Sin node_modules o
claves operativas. Las tres copias públicas del visor se comparan byte a byte.

## Verificación final

- Regresión: 123 tests Node aprobados (58 raíz, 28 algoritmos, 11 contratos HTTP,
  13 validación y 13 paginación sin Docker). Seis pruebas PostgreSQL distintas
  adicionales aprobadas. No se vuelve a ejecutar Python/ML en esta entrega.
- ZIP extraído en /tmp/api-pages-zip.1Bo3ux, instalación pnpm offline con el store
  existente y copia entre filesystems: sus diecinueve tests pasan, incluido PostgreSQL.
  Las mediciones de esa repetición se quedan en /tmp, sin sustituir las publicadas.
- Chromium: doce vistas, seis posts por 1440/360, sin overflow o errores de página,
  imágenes decodificadas, links y noindex. Visor: insertar, mover, borrar, reset y
  teclado. Informe /tmp/api-contracts-layout.ebBT0y. Capturas inspeccionadas de
  gráfica, diagrama de evolución y visor móvil. La tabla de tiempos tiene región
  desplazable y ancho mínimo para no partir sus cifras; sin cambios globales CSS.
- Build correcto: 48 rutas y ocho posts indexados; los seis drafts no generan HTML
  o Markdown ni aparecen en llms.txt. ZIP del build byte a byte igual al verificado.
- Servidor temporal detenido, ningún contenedor blog-api-pages restante y
  git diff --check correcto. Se conservan los cambios posteriores a fb190d4 sin commit.

## Límites y continuación

Sin autenticación o autorización: tenant fijo ficticio. Firma, ámbito y expiración
del cursor no conceden permisos ni cifran; sin rotación o revocación. No se ofrece
búsqueda q o ranking: GIN se prueba con SQL directo. Sin exportación consistente,
red/disco frío, QPS o percentiles bajo carga. Dos lectores del mismo repo, no SDK
publicados ni consumidores externos. Negociación Accept y retirada no implementadas.

Continuar P026/P027: sesiones, rotación/reutilización de refresh tokens y OAuth/OIDC
con proveedor de test, verificando firma, issuer, audience y expiración. No sustituir
ese laboratorio por decodificar un JWT ni declarar completada la Serie 03.
