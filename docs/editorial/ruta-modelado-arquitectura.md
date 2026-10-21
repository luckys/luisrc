# Modelar el dominio y comunicar la arquitectura

Serie en español, diez borradores. Amplía las lagunas P044/P047 del roadmap;
no reemplaza los artículos existentes de requisitos y monolito modular. Mantiene
laboratorio completo en `luisrc-blog-examples/packages/domain-design`, con nombres
de carpetas en inglés. Los snippets relevantes siguen dentro de los posts.

## Orden recomendado

Antes: [requisitos y capacidad](../../src/content/posts/es/requisitos-capacidad-invariantes-servicio.md)
y [dependencias y monolito modular](../../src/content/posts/es/monolito-modular-solid-sin-sobreingenieria.md).

1. [Ubiquitous Language](../../src/content/posts/es/ddd-lenguaje-bounded-contexts.md).
2. [Bounded contexts](../../src/content/posts/es/bounded-context-limites-modelos.md).
3. [Entidades e identidad](../../src/content/posts/es/entidades-identidad-ciclo-vida.md).
4. [Value Objects](../../src/content/posts/es/value-objects-igualdad-inmutabilidad.md).
5. [Agregados e invariantes](../../src/content/posts/es/value-objects-agregados-invariantes.md).
6. [Domain services](../../src/content/posts/es/domain-services-politicas-negocio.md).
7. [Repositorios y confirmación](../../src/content/posts/es/repositorios-eventos-dominio-concurrencia.md).
8. [Domain events](../../src/content/posts/es/domain-events-hechos-confirmacion.md).
9. [C4: contexto, contenedores y componentes](../../src/content/posts/es/c4-contexto-contenedores-componentes.md).
10. [ADR, RFC y evidencia](../../src/content/posts/es/adr-decisiones-arquitectura-evidencia.md).

## Por qué un post por concepto de DDD

Petición del autor: explicaciones y ejemplos independientes para cada concepto,
no solo dividir títulos. La revisión del 21 de octubre amplía cinco a diez entregas.
Las cinco URLs originales se conservan, pero los tres posts agrupados se centran
ahora en lenguaje, agregados y repositorios. Los enlaces guían a las nuevas entregas.

Cada concepto DDD tiene problema, definición, mecanismo, código explicado, tests,
alternativas, garantías y límites y ejercicio. Entidades utiliza Shipment; valores,
Money; agregados, Payment; servicios, una política de ventana temporal. Contextos
explica traducción y ownership; eventos separa candidato, confirmación y publicación.
C4 y ADR siguen como dos lecturas posteriores con sus preguntas propias, no patrones
DDD adicionales. El código compartido no se duplica para fabricar diez laboratorios.

## Laboratorio y límites

[Fuentes y tests](https://github.com/luckys/luisrc-blog-examples/blob/main/packages/domain-design/README.md).
TypeScript estricto, Node 24.19.0, tests sin cuentas, Docker o bases de datos.
Dos trazas estáticas generadas por las clases alimentan el visor interactivo.
Tres vistas C4 muestran diseño objetivo; el fake, la ADR propuesta y los componentes
implementados se distinguen expresamente. No hay integración SQL, broker o proveedor.

No dar P044/P047 por aceptados solo por sus IDs. P044 demuestra pagos/reservas y
traducción logística separada, no un flujo completo de pedidos y devoluciones.
P047 compara almacenamiento en una ADR propuesta, sin benchmark de DynamoDB.

Siguiente bloque: revisar y ampliar P043/P045/P046 en entregas específicas sobre
principios y dependencias, puertos/adaptadores y límites de despliegue. Después
revisar los gaps distribuidos, especialmente P048 y P051. No duplicar sin contrastar
los artículos ya existentes ni declarar toda la Serie 05 completa.
