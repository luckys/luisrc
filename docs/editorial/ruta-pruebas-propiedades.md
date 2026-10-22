# Pruebas basadas en propiedades: encontrar y explicar contraejemplos

Siete drafts españoles de P057. Continúan las rutas de pruebas e integración;
amplían OPS-FAULTS sin cambiar sus IDs, sus fuentes ni sus garantías.
Código completo en luisrc-blog-examples/packages/property-testing, con snippets
explicados dentro de cada post. Manifest: property-testing-series.json.

## Orden de lectura

1. [Propiedades y generadores](../../src/content/posts/es/property-based-testing-generadores-invariantes.md): contrato, entradas válidas, ejemplos y oráculos complementarios.
2. [Shrinking y replay](../../src/content/posts/es/shrinking-replay-contraejemplos-fast-check.md): búsqueda, reducción, seed/path y regresión explícita.
3. [Modelo de secuencias](../../src/content/posts/es/model-based-testing-secuencias-pagos.md): tabla independiente, estado, efectos y comparación tras cada evento.
4. [Race conditions](../../src/content/posts/es/race-conditions-scheduler-fast-check.md): promesas controladas, actualización perdida y arreglo solo local.
5. [Fuzzing del parser](../../src/content/posts/es/fuzzing-parser-bytes-generadores-estructurados.md): bytes, mensajes válidos y error del propio oráculo.
6. [Fault injection](../../src/content/posts/es/fault-injection-respuesta-perdida-propiedades.md): frontera antes/después del efecto, clave estable y recuperación condicionada.
7. [Mutaciones de propiedades](../../src/content/posts/es/mutation-testing-evaluar-propiedades.md): tres variantes seleccionadas y un superviviente de la regla débil.

## Por qué siete partes

Cada una tiene pregunta, mecanismo y ejercicio propio. Shrinking/replay permanecen
juntos porque resolver el fallo incluye repetir y conservar el caso. Fuzzing y
fault injection se separan: cambiar bytes no equivale a fallar entre dos efectos.
La última entrega amplía TEST-COVERAGE con oráculos generados, no repite su
introducción de coverage. No se asignan siete IDs del roadmap para aparentar avance.

## Laboratorio y límites

fast-check4.10.2 y Node24.19.0. Quince tests: propiedades y ejemplos, reducción,
replay, scheduler generado y regresión explícita, parser, fallos y variantes.
El defecto de rechazo atrasado se reduce a submit/confirm/decline y falla en la
variante; la misma regresión pasa en el fix. Evidencia con hashes en el monorepo.

Una operación en memoria, arrays normales, no fc.commands. No PSP real, red, SQL,
crash de proceso, disco durable, motor Stryker o fuzzing guiado por cobertura.
Estado/capturas y proveedor fake son modelos separados. No cerrar toda Serie06
por recuento de artículos. Ver property-testing-review.md para comprobaciones.

## Siguiente bloque

P058 carga y profiling. Contrastar pruebas-carga-percentiles-saturacion y el
paquete reliable-services antes de ampliar. Separar distribución/percentiles,
modelo de carga/saturación, warm-up/reproducibilidad y CPU/memoria según el
laboratorio real; no presentar una fórmula de cola como benchmark de un servidor.
Después P059/P060 observabilidad. Gaps P026 y Stripe sandbox P045 conservados.
Español/draft, sin traducción, audio, publicación o push automáticos.
