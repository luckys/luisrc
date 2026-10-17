# Glosario de la serie de bases de datos

Las definiciones se desarrollan en el artículo indicado; este índice evita
reintroducirlas completas en cada entrega.

| Término               | Idea                                                                                | Artículo               |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------- |
| Constraint            | Regla que exige el motor sobre los datos persistidos                                | Modelado e integridad  |
| Cardinality           | Número de entidades o filas; precisar si es relación, resultado o valores distintos | Modelado / índices     |
| Snapshot              | Visión lógica que determina qué versiones son visibles                              | Aislamiento y MVCC     |
| Write skew            | Decisiones concurrentes sobre datos relacionados que rompen una regla conjunta      | Aislamiento y MVCC     |
| Lost update           | Una escritura sobrescribe un resultado concurrente que debía considerar             | Concurrencia           |
| Optimistic locking    | Detectar cambios mediante una versión esperada                                      | Concurrencia           |
| Grain                 | Qué representa una fila de una relación o resultado                                 | SQL, primera parte     |
| Window frame          | Filas de una partición lógica que participan para la fila actual                    | SQL, segunda parte     |
| Functional dependency | Un conjunto de atributos determina otro en el modelo                                | Normalización          |
| Selectivity           | Fracción de filas que satisface un predicado                                        | Índices, primera parte |
| Covering index        | Índice que contiene los valores necesarios para una consulta                        | Índices, segunda parte |
| Planner / executor    | Elección del plan / ejecución de sus operadores                                     | EXPLAIN ANALYZE        |
| Backfill              | Rellenar datos existentes durante una evolución de esquema                          | Migraciones            |
| Partition pruning     | Descartar particiones incompatibles con un predicado                                | Particionado           |
| Cache-aside           | La aplicación carga la caché desde la fuente cuando falta una entrada               | Redis                  |
| Access pattern        | Forma concreta de leer o modificar datos                                            | Elección de motores    |
