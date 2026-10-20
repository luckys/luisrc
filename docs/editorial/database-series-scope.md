# Serie: Fundamentos de bases de datos

## Encargo y alcance

Ampliación solicitada el 2026-10-17. Solo español, en borrador, sin publicar,
traducir, generar narraciones ni hacer commit. Los fundamentos son independientes
de PaySafe y transferibles a cualquier proyecto. Los casos de pedidos, inventario,
guardias y documentos son ficticios y no constituyen productos de producción.

Público: ingenieros que conocen SQL elemental y programación, pero necesitan
razonar sobre integridad, concurrencia, consultas, operación y almacenamiento.

## Orden de lectura

1. DB-ACID: Propiedades ACID (existente).
2. DB-TRANSACTIONS: Transacciones (existente).
3. DB-MODEL: Modelado relacional e integridad (P032).
4. DB-ISOLATION: Aislamiento y MVCC (resto de P037).
5. DB-CONCURRENCY: Control de concurrencia (P038).
6. DB-SQL: JOIN, NULL y agregaciones (P033, parte 1).
7. DB-ANALYTICS: CTE, ventanas y cohortes (P033, parte 2).
8. DB-NORMALIZATION: Normalización y desnormalización (P034).
9. DB-INDEXES: Índices y coste de escritura (P035, parte 1).
10. DB-INDEX-DESIGN: Índices compuestos, parciales y covering (P035, parte 2).
11. DB-PLANS: Planes de ejecución y diagnóstico (P036).
12. DB-MIGRATIONS: Migraciones compatibles (P041, parte 1).
13. DB-PARTITIONING: Particionado y retención (P041, parte 2).
14. DB-CACHE: Redis y caché (P039).
15. DB-STORAGE: Elección de motores (P040).

El orden de lectura no obliga a depender del laboratorio anterior. Cada experimento
reinicia exclusivamente su esquema ficticio. Un laboratorio descargable común evita
repetir la configuración de Docker en trece artículos.

## Criterios de revisión

- Una pregunta dominante, objetivos, prerrequisitos y siguiente lectura por artículo.
- Apertura concreta, inglés técnico explicado, decisiones y alternativas razonadas.
- Código completo del experimento, rutas y forma de ejecutarlo.
- Diagramas SVG estáticos con alt y fuentes versionadas; no Mermaid sin renderizar.
- Fallo observable, corrección, resultado y límites; ejercicios con aceptación.
- Fuentes primarias consultadas el 2026-10-17 y PostgreSQL 18 como referencia.
- No números de rendimiento inventados ni promesas generales de disponibilidad.
- Pruebas reales para los experimentos PostgreSQL/Redis; comparación de motores
  explícitamente conceptual cuando no se ejecutan MongoDB y DynamoDB.
- Integridad de enlaces, metadatos, recursos y compilación del sitio.

## Entregables

Artículos en `src/content/posts/es/`, laboratorio en `https://github.com/luckys/luisrc-blog-examples/blob/main/packages/database-fundamentals/`,
diagramas fuente en `assets/database-series/`, recursos públicos en
`public/assets/visuals/database-series/` e inventario en
`docs/editorial/database-fundamentals.yaml`.
