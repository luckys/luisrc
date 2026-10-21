# Revisión de cobertura antes de continuar arquitectura

Fecha: 2026-10-20. Revisión de temarios y evidencia archivada, no nueva ejecución
de los laboratorios PostgreSQL/Redis. No equivale a aceptar todas las fichas.

## Serie 04: reutilizar quince entregas, no redactar otras diez con los mismos títulos

Se contrastaron las fichas P032–P041 con `database-fundamentals.yaml`, los trece
artículos añadidos y la revisión de las dos entregas originales. Los IDs DB-* son
válidos y se conservan: no renumerarlos para inflar el inventario Pxxx.

| Ficha | Artículos existentes | Evidencia o límite que conservar |
| --- | --- | --- |
| P032 | DB-MODEL | PK/FK, cardinalidad, CHECK/UNIQUE y constraints; no modelo completo de todos los productos |
| P033 | DB-SQL, DB-ANALYTICS | JOIN/NULL/EXISTS y grano; CTE, ventanas, ranking y cohortes |
| P034 | DB-NORMALIZATION | Dependencias y 1NF–3NF; resumen derivado y divergencia; ampliar medición específica de desnormalización si se exige su DoD completo |
| P035 | DB-INDEXES, DB-INDEX-DESIGN | Familias, selectividad, compuestos/parciales/INCLUDE; medición sintética de lectura/WAL, no benchmark universal |
| P036 | DB-PLANS | Estimaciones/loops/buffers/joins y N+1; planes reales archivados |
| P037 | DB-ACID, DB-TRANSACTIONS, DB-ISOLATION | Atomicidad, MVCC, snapshots/write skew; reinicio ordenado no es corte eléctrico |
| P038 | DB-CONCURRENCY | Lost update, escritura condicional, UNIQUE/UPSERT, versiones, locks/deadlocks |
| P039 | DB-CACHE | Carrera cache-aside y stale reads; las otras políticas se comparan, no se implementan todas |
| P040 | DB-STORAGE | Modelos y motores especializados; MongoDB/DynamoDB conceptuales, no comparación ejecutada de cuatro motores |
| P041 | DB-MIGRATIONS, DB-PARTITIONING | Expand/migrate/contract y retención; SQL secuencial, no rolling deployment; particiones pequeñas |

La revisión anterior declara PostgreSQL 18.4/Redis reales y catorce pruebas de la
ampliación. No se repiten esas cifras como una ejecución de hoy. Faltan verificaciones
para afirmar cumplimiento completo de P034/P040 y despliegue coexistente de P041.
Esos gaps no justifican duplicar las explicaciones que ya existen.

## Serie 05: dónde aporta contenido nuevo este bloque

- P042 tiene requisitos, invariantes y capacidad hipotética en DESIGN-REQUIREMENTS.
- P043/P045/P046 comparten un artículo introductorio DESIGN-MODULES. No considerarlo
  tres fichas completas: faltan ejercicios independientes y comparación profunda.
- P044 no tenía entrega propia: se añade vocabulario/contextos, valores/agregados,
  coordinación/repositorios/eventos, con un fixture probado y límites explícitos.
- P047 no tenía entrega propia: se añaden C4 y ADR/RFC. La elección PostgreSQL vs
  DynamoDB es una propuesta razonada, no resultado de comparar servicios ejecutados.
- P048–P054 tienen artículos relacionados salvo Kafka P051. Revisar quorum/consenso,
  replicación, CAP/PACELC y streaming antes de afirmar cobertura general. No volver
  a escribir outbox o sagas sin leer sus artículos y límites.

## Series posteriores

La Serie 06 tiene ocho artículos agrupados de pruebas/operación, pero AWS P064 y
Terraform/Kubernetes P065 no tienen entrega. Ese bloque exige su propia revisión,
no se declara cubierto aquí. La continuación actual se mantiene en Serie 05.

El inventario automático cuenta archivos e IDs, no evidencia de aceptación. Los
cinco drafts nuevos no completan todo el roadmap ni toda la serie de arquitectura.
