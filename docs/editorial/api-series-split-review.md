# División editorial de APIs: seis fichas, doce entregas

Solicitud: aplicar la revisión para explicar los temas con más detalle. Punto de
partida: commit 89f67b4, árbol limpio. No se crean fichas P026–P031 ni se continúa
con sesiones durante este encargo. Español, draft y autor Luis Ramírez Calle.

## Alcance y correspondencia

| Ficha | Entregas | Preguntas separadas |
| --- | --- | --- |
| P020 | 1 | Qué promete el contrato. |
| P021 | 1 | Qué significan los métodos al compararlos. |
| P022 | 3 | Qué validar; cómo hacerlo en Zod; alternativa Pydantic. |
| P023 | 2 | Qué error observa el cliente; cómo diagnosticar sin filtrar. |
| P024 | 3 | Cómo continuar; qué cambia bajo escrituras; cuánto trabajo cuesta. |
| P025 | 2 | Qué rompe al consumidor; cómo operar una transición. |

Los seis slugs originales se conservan y sirven de entrada a cada bloque. Se añaden
seis IDs API-* para partes, no nuevos IDs del catálogo general. El inventario sigue
teniendo 45 IDs exactos, 38 fichas relacionadas y 92 pendientes de identificar.
No equivale a aceptación del roadmap completo. Faltan P026–P031.

## Cambios de contenido, no solo cortes

- Se amplía JSON Schema con una estrategia de casos que cambia una decisión cada
  vez, bordes Unicode y diferencia entre límite del body y límite de un campo.
- Zod tiene recorrido propio desde safeParse al comando, errores públicos y salida.
  Pydantic detalla before/after, el entero JSON 2.0, bool/string, defaults y
  exclude_unset. Ninguna entrega posterior exige la ruta Python.
- Errores públicos conserva stock/versión y límites de un proceso. Diagnóstico
  explica cada dato del log, propagación local, pruebas con secretos ficticios y
  fallo del logger, sin afirmar instrumentación distribuida que no existe.
- Navegación explica el empate fecha/ID y lookahead. Consistencia desarrolla dos
  conexiones, READ COMMITTED, REPEATABLE READ y una clave mutable. Rendimiento
  interpreta scanOutputRows, cachés y ancla excluida antes de extrapolar tiempos.
- Compatibilidad mantiene lectores y schemas con regresiones deliberadas. Migración
  explica URLs/headers, SDK, Deprecation/Sunset, guía y criterios de retirada.
- Cada entrega tiene introducción, mecanismo, casos/límites, ejercicio y fuentes.
  Se mantienen términos técnicos en inglés y se eliminan notas internas de edición
  del cuerpo de los posts. No se rellena con conclusiones genéricas.
- Se añaden seis D2/SVG; el diagrama de P024 pasa a describir navegación y el
  experimento original tiene su propio diagrama en consistencia. La gráfica y tabla
  de mediciones solo están en rendimiento. Visor compartido vinculado a consistencia.

## Coherencia y reproducibilidad

Manifiesto, fechas y ruta tienen el mismo orden. Tests nuevos verifican doce IDs,
seis URLs conservadas, distribución 1/1/3/2/3/2, dependencias anteriores y Python
opcional. No se debilita el mínimo editorial anterior: todas las entregas superan
la comprobación de extensión ya existente. Se prueban también encabezados movidos
para evitar dejar los temas duplicados en el artículo de entrada.

Los fragmentos publicados coinciden con código probado: nueve JS, tres Python y
cuatro SQL; además se comprueban los dos JSON ya existentes. Hay trece imágenes
con alt y dimensiones reales, una por post y la gráfica adicional en rendimiento.
Los README asignan entregas a archivos/tests y sus ZIP se regeneran por allowlist.

No cambia código ejecutable de los laboratorios, dependencias, lockfiles, resultados
medidos o protocolo PostgreSQL. Las muestras originales conservan hashes válidos;
no se vuelve a medir para cambiar cifras innecesariamente. Las pruebas SQL ejecutadas
en la entrega anterior siguen documentadas en api-pagination-evolution-review.md.

## Verificación de esta división

- 96 tests Node aprobados: 59 raíz, once del laboratorio HTTP, trece de validación
  y trece sin Docker de paginación/evolución.
- Cuatro tests Pydantic ejecutados y aprobados, en imagen ya local, sin red y con
  montaje de lectura. No hay un segundo servidor Python en la demo.
- Seis tests editoriales comprueban estructura, fragmentos, archivos, resultados,
  optional y assets. Se reutiliza la evidencia anterior de seis tests PostgreSQL;
  no se cuentan como nuevas ejecuciones en esta división.
- Chromium real: 24 vistas, doce posts por 1440/360, y cinco casos del visor
  (insertar, mover, borrar, reset y teclado). Informe final y capturas en
  /tmp/api-contracts-layout.AFfj8M. Sin overflow horizontal, errores de página,
  imágenes sin decodificar o enlaces locales rotos en el recorrido comprobado.
- Inspección visual de los nuevos diagramas y del diagrama actualizado de navegación.
  Se acortaron etiquetas y se hizo vertical el flujo de logs tras detectar texto
  demasiado pequeño en móvil. Todos conservan alt y enlace de ampliación.
- Un intento intermedio coincidió con recargas de edición y abortó una navegación;
  se reinició el servidor con fuentes estables y se completó todo el recorrido.
  No se omitió el caso fallido ni se añadieron pausas fijas para ocultarlo.
- Build correcto, 48 rutas y ocho posts indexados. Los doce drafts no aparecen en
  HTML, Markdown o llms.txt. Tres ZIP del build idénticos a sus versiones verificadas.
  Servidor temporal detenido al terminar y git diff --check correcto.

El encargo no incluye commit, push, traducción, audio o publicación. Los cambios
de división quedan pendientes de commit. La siguiente ficha editorial sigue siendo
P026, no una parte de validación o paginación renumerada.
